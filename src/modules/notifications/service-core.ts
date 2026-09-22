import type { EmailNotificationType } from "@prisma/client";
import { centralUser } from "@/modules/auth/directory";
import { db } from "@/server/db/client";
import { MAX_DELIVERY_ATTEMPTS, safeDeliveryError, type NotificationTemplateData } from "./domain";
import { createNotificationDeliveryProvider, type NotificationDeliveryProvider } from "./delivery-core";

// Local authentication is gone, so these types can never be delivered again. Retiring them
// keeps retryNotifications from selecting the same rows on every run.
const RETIRED_TYPES: EmailNotificationType[] = ["PASSWORD_RESET", "USER_INVITATION"];

/**
 * Ends delivery for a row that cannot succeed, instead of returning early. An early return
 * would leave attemptCount and nextAttemptAt untouched, so every later retry run would pick
 * the same row up again and fail identically, forever.
 */
async function stopDelivery(id: string, reason: string, terminal: boolean) {
  await db.emailNotification.update({ where: { id }, data: {
    status: "FAILED", failedAt: new Date(), lastError: reason,
    // A retired type will never become deliverable; a missing mapping still can, so that one
    // keeps its remaining attempts and simply backs off like any other delivery failure.
    ...(terminal ? { attemptCount: MAX_DELIVERY_ATTEMPTS, nextAttemptAt: null } : { attemptCount: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 5 * 60_000) }),
  } });
  return false;
}

export async function sendNotification(id: string, options: { provider?: NotificationDeliveryProvider; sensitiveData?: NotificationTemplateData } = {}) {
  const notification = await db.emailNotification.findUnique({ where: { id } });
  if (!notification || !["PENDING", "FAILED"].includes(notification.status) || notification.attemptCount >= MAX_DELIVERY_ATTEMPTS) return false;
  if (RETIRED_TYPES.includes(notification.type)) return stopDelivery(id, "Benachrichtigungstyp wird nicht mehr zugestellt.", true);
  const recipient = notification.recipientUserId ? await centralUser(notification.recipientUserId) : null;
  if (!recipient) return stopDelivery(id, "Empfänger ist kein aktueller zentraler Benutzer.", false);
  const data = { ...((notification.templateData ?? {}) as NotificationTemplateData), ...(options.sensitiveData ?? {}) };
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
  const rows = await db.emailNotification.findMany({ where: { type: { notIn: RETIRED_TYPES }, status: { in: ["PENDING", "FAILED"] }, attemptCount: { lt: MAX_DELIVERY_ATTEMPTS }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, select: { id: true }, take: 100 });
  await sendNotifications(rows.map(({ id }) => id));
  return rows.length;
}
