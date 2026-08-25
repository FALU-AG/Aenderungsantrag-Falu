import "server-only";
import { Resend, type WebhookEventPayload } from "resend";
import { db } from "@/server/db/client";

export function verifyResendWebhook(payload: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET) {
  if (!secret) throw new Error("Webhook nicht konfiguriert.");
  const id = headers.get("svix-id"), timestamp = headers.get("svix-timestamp"), signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) throw new Error("Webhook-Signatur fehlt.");
  return new Resend(process.env.RESEND_API_KEY).webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret });
}

export async function applyResendWebhook(event: WebhookEventPayload) {
  if (!("data" in event) || !("email_id" in event.data)) return;
  const statuses: Partial<Record<WebhookEventPayload["type"], "SENT" | "DELIVERED" | "BOUNCED" | "COMPLAINED" | "FAILED">> = { "email.sent": "SENT", "email.delivered": "DELIVERED", "email.bounced": "BOUNCED", "email.complained": "COMPLAINED", "email.failed": "FAILED" };
  const status = statuses[event.type];
  if (!status) return;
  await db.emailNotification.updateMany({ where: { providerMessageId: event.data.email_id }, data: { status, ...(status === "FAILED" ? { failedAt: new Date(), lastError: "Der E-Mail-Provider meldete einen Versandfehler." } : {}) } });
}
