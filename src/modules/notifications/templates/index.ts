import type { EmailNotificationType } from "@prisma/client";
import type { NotificationTemplateData } from "../domain";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderNotification(type: EmailNotificationType, subject: string, data: NotificationTemplateData) {
  const action = data.action ?? ({
    PASSWORD_RESET: "Setzen Sie Ihr Passwort über den sicheren Link neu.", USER_INVITATION: "Richten Sie Ihr Konto ein.",
    APPROVAL_REQUIRED_AVOR: "Ein Änderungsantrag wartet auf Ihre AVOR-Freigabe.", APPROVAL_REQUIRED_TECHNICAL: "Ein Änderungsantrag wartet auf Ihre technische Freigabe.",
    TASK_ASSIGNED: "Ihnen wurde eine neue Aufgabe zugewiesen.", REQUEST_CHANGES_REQUIRED: "Der Antrag muss überarbeitet und erneut eingereicht werden.",
    REQUEST_APPROVED: "Der Änderungsantrag wurde zur Umsetzung freigegeben.", REQUEST_PHASE_CHANGED: "Der Status des Änderungsantrags hat sich geändert.", REQUEST_CLOSED: "Der Änderungsantrag wurde abgeschlossen.",
  } as Record<EmailNotificationType, string>)[type];
  const lines = [String(action), data.number && `Antrag: ${data.number}`, data.title && `Titel: ${data.title}`, data.detail && String(data.detail), data.url && `Link: ${data.url}`].filter(Boolean);
  const button = data.url ? `<p style="margin:24px 0"><a href="${escape(data.url)}" style="background:#175f91;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none">In FALU Change Request öffnen</a></p>` : "";
  return {
    text: `${subject}\n\n${lines.join("\n")}\n\nFALU Change Request`,
    html: `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:auto;padding:24px"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:28px"><p style="color:#175f91;font-weight:700">FALU Change Request</p><h1 style="font-size:22px">${escape(subject)}</h1>${lines.map((line) => `<p>${escape(line)}</p>`).join("")}${button}</div></div></body></html>`,
  };
}
