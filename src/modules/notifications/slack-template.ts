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
  REQUEST_INACTIVITY_REMINDER: "Hinweis zum Änderungsantrag",
  WEEKLY_TASK_DIGEST: "Persönliche Wochenübersicht",
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
    blocks.splice(0, blocks.length,
      { type: "header", text: { type: "plain_text", text: `Guten Morgen ${value(data.greetingName)}`, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: "Hier ist deine Übersicht für diese Woche:" } },
    );
    const addSection = (title: string, items: unknown, render: (item: Record<string, unknown>) => string) => {
      if (!Array.isArray(items) || items.length === 0) return;
      for (let index = 0; index < items.length; index += 12) {
        const heading = index === 0 ? `*${title}*\n` : "";
        blocks.push({ type: "section", text: { type: "mrkdwn", text: `${heading}${items.slice(index, index + 12).map((item) => render(item as Record<string, unknown>)).join("\n")}` } });
      }
    };
    const taskLine = (item: Record<string, unknown>) => `• *${escapeSlack(item.number)}* – ${escapeSlack(item.title)}${value(item.dueDate) ? ` – fällig ${escapeSlack(item.dueDate)}` : ""}`;
    addSection("Überfällige Aufgaben", data.overdue, taskLine);
    addSection("Diese Woche fällige Aufgaben", data.dueThisWeek, taskLine);
    addSection("Weitere offene Aufgaben", data.other, taskLine);
    addSection("Eigene Änderungsanträge", data.ownRequests, (item) => `• *${escapeSlack(item.number)}* – ${escapeSlack(item.title)} – ${escapeSlack(item.status)}`);
    addSection("Offene Freigaben", data.approvals, (item) => `• *${escapeSlack(item.number)}* – ${escapeSlack(item.title)} – ${escapeSlack(item.responsibility)}`);
  }
  if (type === "REQUEST_CLOSED" && data.completionSummary) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Umgesetzt*\n${escapeSlack(data.completionSummary)}` } });
    if (data.completedAt) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Abgeschlossen am ${escapeSlack(data.completedAt)}` }] });
  }
  if (data.url) {
    blocks.push({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: type === "WEEKLY_TASK_DIGEST" ? "Zur Übersicht" : "Änderungsantrag öffnen" }, url: value(data.url), action_id: "open_change_request" }],
    });
  }
  return { text: `${heading}: ${labels[type] ?? subject}`, blocks };
}
