import type { EmailNotificationType } from "@prisma/client";
import type { NotificationTemplateData } from "./domain";
import type { SlackBlock } from "./slack-provider";

const labels: Partial<Record<EmailNotificationType, string>> = {
  APPROVAL_REQUIRED_AVOR: "AVOR-Freigabe erforderlich",
  APPROVAL_REQUIRED_TECHNICAL: "Technische Freigabe erforderlich",
  TASK_ASSIGNED: "Aufgabe zugewiesen",
  REQUEST_CHANGES_REQUIRED: "Überarbeitung erforderlich",
  REQUEST_APPROVED: "Änderungsantrag freigegeben",
  REQUEST_PHASE_CHANGED: "Status aktualisiert",
  REQUEST_CLOSED: "Änderungsantrag abgeschlossen",
  REQUEST_INACTIVITY_REMINDER: "Keine Aktivität seit 7 Tagen",
  WEEKLY_TASK_DIGEST: "Wöchentliche Aufgabenübersicht",
};

const value = (input: unknown) => typeof input === "string" || typeof input === "number" ? String(input) : "";
const escapeSlack = (input: unknown) => value(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderSlackNotification(type: EmailNotificationType, subject: string, data: NotificationTemplateData) {
  const heading = value(data.number) ? `Änderungsantrag ${value(data.number)}` : labels[type] ?? subject;
  const fields = [
    ["Titel", data.title],
    ["Antragsteller", data.applicantName],
    ["Maschinentyp", data.machineTypes],
    ["Status", data.status ?? data.phase],
    ["Details", data.detail],
  ].filter((entry) => value(entry[1]));
  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: heading, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${labels[type] ?? subject}*` } },
  ];
  if (fields.length) {
    blocks.push({
      type: "section",
      fields: fields.map(([label, fieldValue]) => ({ type: "mrkdwn", text: `*${label}*\n${escapeSlack(fieldValue)}` })),
    });
  }
  if (type === "WEEKLY_TASK_DIGEST") {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Offen:* ${value(data.openCount)}  •  *Überfällig:* ${value(data.overdueCount)}  •  *Diese Woche:* ${value(data.dueThisWeekCount)}` },
    });
    const tasks = [data.overdue, data.dueThisWeek, data.other]
      .flatMap((group) => Array.isArray(group) ? group : [])
      .slice(0, 10)
      .map((task) => {
        const item = task as Record<string, unknown>;
        return `• *${escapeSlack(item.number)}* – ${escapeSlack(item.title)} (${escapeSlack(item.dueDate)})`;
      });
    if (tasks.length) blocks.push({ type: "section", text: { type: "mrkdwn", text: tasks.join("\n") } });
  }
  if (data.url) {
    blocks.push({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: type === "WEEKLY_TASK_DIGEST" ? "Meine Aufgaben öffnen" : "Änderungsantrag öffnen" }, url: value(data.url), action_id: "open_change_request" }],
    });
  }
  return { text: `${heading}: ${labels[type] ?? subject}`, blocks };
}
