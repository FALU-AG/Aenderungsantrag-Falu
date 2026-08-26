import type { EmailNotificationType } from "@prisma/client";

export type NotificationTemplateData = Record<string, unknown>;
export type NotificationInput = {
  type: EmailNotificationType;
  idempotencyKey: string;
  recipientUserId?: string;
  recipientEmail: string;
  recipientName?: string;
  changeRequestId?: string;
  taskId?: string;
  subject: string;
  templateData?: NotificationTemplateData;
};

export const MAX_DELIVERY_ATTEMPTS = 5;
export const PASSWORD_RESET_TTL_MINUTES = 30;

export function safeDeliveryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Versandfehler";
  return message.replace(/\b(re_|whsec_)[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}
