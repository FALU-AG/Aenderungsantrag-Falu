import type { EmailNotificationType } from "@prisma/client";
import type { NotificationTemplateData } from "./domain";
import { createEmailProvider, type EmailProvider } from "./email-client";
import { createSlackProvider, type SlackProvider } from "./slack-client";
import { renderSlackNotification } from "./slack-template";
import { renderNotification } from "./templates";

export type NotificationChannel = "email" | "slack";
export type DeliveryPayload = { type: EmailNotificationType; recipientEmail: string; recipientName?: string | null; subject: string; idempotencyKey: string; data: NotificationTemplateData };
export type NotificationDeliveryProvider = { send(payload: DeliveryPayload): Promise<{ id: string }> };

export function notificationChannel(type: EmailNotificationType): NotificationChannel {
  return type === "PASSWORD_RESET" || type === "USER_INVITATION" ? "email" : "slack";
}

export function createNotificationDeliveryProvider(options: { email?: EmailProvider; slack?: SlackProvider } = {}): NotificationDeliveryProvider {
  return {
    async send(payload) {
      if (notificationChannel(payload.type) === "email") {
        const content = renderNotification(payload.type, payload.subject, payload.data);
        return (options.email ?? createEmailProvider()).send({ to: payload.recipientEmail, subject: payload.subject, idempotencyKey: payload.idempotencyKey, ...content });
      }
      const content = renderSlackNotification(payload.type, payload.subject, payload.data);
      return (options.slack ?? createSlackProvider()).send({ toEmail: payload.recipientEmail, recipientName: payload.recipientName, ...content });
    },
  };
}
