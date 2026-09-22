import { centralUser } from "@/modules/auth/directory";
import { db } from "@/server/db/client";
import { MAX_DELIVERY_ATTEMPTS, safeDeliveryError, type NotificationTemplateData } from "./domain";
import { createNotificationDeliveryProvider, type NotificationDeliveryProvider } from "./delivery-core";

export async function sendNotification(id: string, options: { provider?: NotificationDeliveryProvider; sensitiveData?: NotificationTemplateData } = {}) {
  const notification = await db.emailNotification.findUnique({ where: { id } });
  if (!notification || !["PENDING", "FAILED"].includes(notification.status) || notification.attemptCount >= MAX_DELIVERY_ATTEMPTS) return false;
  if (["PASSWORD_RESET", "USER_INVITATION"].includes(notification.type)) return false;
  const recipient = notification.recipientUserId ? await centralUser(notification.recipientUserId) : null;
  if (!recipient) return false;
  const data = { ...((notification.templateData ?? {}) as NotificationTemplateData), ...(options.sensitiveData ?? {}) };
  if (notification.type === "PASSWORD_RESET" && !data.url) return false;
  try {
    const result = await (options.provider ?? createNotificationDeliveryProvider()).send({ type: notification.type, recipientEmail: recipient.email, recipientName: recipient.name, subject: notification.subject, data, idempotencyKey: notification.idempotencyKey });
    await db.emailNotification.update({ where: { id }, data: { status: "SENT", providerMessageId: result.id === "disabled" ? null : result.id, sentAt: new Date(), failedAt: null, lastError: null, attemptCount: { increment: 1 } } });
    return true;
  } catch (error) {
    await db.emailNotification.update({ where: { id }, data: { status: "FAILED", failedAt: new Date(), lastError: safeDeliveryError(error), attemptCount: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 5 * 60_000) } });
    return false;
  }
}

export async function sendNotifications(ids: string[]) {
  await Promise.allSettled([...new Set(ids)].map((id) => sendNotification(id)));
}

export async function retryNotifications() {
  const rows = await db.emailNotification.findMany({ where: { type: { not: "PASSWORD_RESET" }, status: { in: ["PENDING", "FAILED"] }, attemptCount: { lt: MAX_DELIVERY_ATTEMPTS }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, select: { id: true }, take: 100 });
  await sendNotifications(rows.map(({ id }) => id));
  return rows.length;
}
