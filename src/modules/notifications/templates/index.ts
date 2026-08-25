import type { EmailNotificationType } from "@prisma/client";
import type { NotificationTemplateData } from "../domain";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const presentation: Record<EmailNotificationType, { heading: string; action: string; cta: string; accent: string; status: string }> = {
  PASSWORD_RESET: { heading: "Passwort zurücksetzen", action: "Sie haben angefordert, Ihr Passwort für FALU Change Request zurückzusetzen.", cta: "Passwort neu setzen", accent: "#175f91", status: "Sicherheit" },
  USER_INVITATION: { heading: "Einladung zu FALU Change Request", action: "Ihr Zugang zu FALU Change Request wurde vorbereitet.", cta: "Konto einrichten", accent: "#175f91", status: "Einladung" },
  APPROVAL_REQUIRED_AVOR: { heading: "AVOR-Freigabe erforderlich", action: "Ein Änderungsantrag wartet auf Ihre AVOR-Freigabe.", cta: "Freigabe prüfen", accent: "#b7791f", status: "Aktion erforderlich" },
  APPROVAL_REQUIRED_TECHNICAL: { heading: "Technische Freigabe erforderlich", action: "Ein Änderungsantrag wartet auf Ihre technische Freigabe.", cta: "Freigabe prüfen", accent: "#b7791f", status: "Aktion erforderlich" },
  TASK_ASSIGNED: { heading: "Neue Aufgabe", action: "Ihnen wurde eine neue Aufgabe zugewiesen.", cta: "Aufgabe öffnen", accent: "#175f91", status: "Neue Aufgabe" },
  REQUEST_CHANGES_REQUIRED: { heading: "Änderung erforderlich", action: "Der Antrag muss überarbeitet und erneut eingereicht werden.", cta: "Antrag überarbeiten", accent: "#b42318", status: "Überarbeitung erforderlich" },
  REQUEST_APPROVED: { heading: "Antrag freigegeben", action: "Der Änderungsantrag wurde zur Umsetzung freigegeben.", cta: "Antrag anzeigen", accent: "#16803a", status: "Freigegeben" },
  REQUEST_PHASE_CHANGED: { heading: "Status aktualisiert", action: "Der Status des Änderungsantrags hat sich geändert.", cta: "Antrag anzeigen", accent: "#175f91", status: "Statusänderung" },
  REQUEST_CLOSED: { heading: "Änderungsantrag abgeschlossen", action: "Der Änderungsantrag wurde abgeschlossen.", cta: "Antrag anzeigen", accent: "#16803a", status: "Abgeschlossen" },
};

const emailHeader = () => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:0 0 20px;border-bottom:1px solid #dbe3ea"><div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:700;letter-spacing:.3px;color:#175f91">FALU AG</div><div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#667085">Change Request</div></td></tr></table>`;

function emailDetails(data: NotificationTemplateData) {
  const details = [["Änderungsantrag", data.number], ["Titel", data.title], ["Maschinentypen", data.machineTypes], ["Antragsteller", data.applicantName], ["Details", data.detail]].filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined && entry[1] !== "");
  if (!details.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-top:1px solid #e4e9ee">${details.map(([label, value]) => `<tr><td valign="top" style="width:138px;padding:11px 12px 11px 0;border-bottom:1px solid #e4e9ee;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#667085">${escape(label)}</td><td valign="top" style="padding:11px 0;border-bottom:1px solid #e4e9ee;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:21px;font-weight:600;color:#172b3a">${escape(value)}</td></tr>`).join("")}</table>`;
}

const emailButton = (url: string, label: string) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" class="button-table" style="margin:24px 0 20px"><tr><td align="center" bgcolor="#175f91" style="border-radius:6px"><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border:1px solid #175f91;border-radius:6px">${escape(label)}</a></td></tr></table>`;
const fallbackLink = (url: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#667085">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br><a href="${escape(url)}" style="color:#175f91;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere">${escape(url)}</a></td></tr></table>`;
const emailFooter = () => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:20px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7b8794">FALU AG &middot; Change Request<br>Diese Nachricht wurde automatisch erstellt.</td></tr></table>`;

function plainText(type: EmailNotificationType, heading: string, action: string, data: NotificationTemplateData, cta: string) {
  const details = [["Änderungsantrag", data.number], ["Titel", data.title], ["Maschinentypen", data.machineTypes], ["Antragsteller", data.applicantName], ["Details", data.detail]].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => `${label}: ${value}`);
  const security = type === "PASSWORD_RESET" ? ["Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden.", "Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren."] : [];
  return ["FALU AG", "Change Request", "", heading, "", action, ...(details.length ? ["", ...details] : []), ...(data.url ? ["", `${cta}:`, String(data.url)] : []), ...(security.length ? ["", ...security] : []), "", "FALU AG · Change Request"].join("\n");
}

export function renderNotification(type: EmailNotificationType, _subject: string, data: NotificationTemplateData) {
  const design = presentation[type];
  const action = String(data.action ?? design.action);
  const url = data.url ? String(data.url) : "";
  const passwordHint = type === "PASSWORD_RESET" ? `<p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#475467">Dieser Link ist 30 Minuten gültig und kann nur einmal verwendet werden.</p><p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#667085">Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>` : "";
  return {
    text: plainText(type, design.heading, action, data, design.cta),
    html: `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:480px){.email-pad{padding:16px!important}.email-card{padding:22px 18px!important}.button-table{width:100%!important}.button-table td,.button-table a{display:block!important;width:auto!important}}</style></head><body style="margin:0;padding:0;background:#f3f6f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f6f9"><tr><td align="center" class="email-pad" style="padding:28px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px"><tr><td class="email-card" bgcolor="#ffffff" style="padding:30px 32px;border:1px solid #dbe3ea;border-radius:8px">${emailHeader()}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-top:24px"><span style="display:inline-block;padding:4px 9px;border-left:3px solid ${design.accent};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;color:${design.accent};text-transform:uppercase;letter-spacing:.4px">${escape(design.status)}</span><h1 style="margin:14px 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:31px;font-weight:700;color:#172b3a">${escape(design.heading)}</h1><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#344054">${escape(action)}</p>${emailDetails(data)}${url ? emailButton(url, design.cta) : ""}${passwordHint}${url ? fallbackLink(url) : ""}</td></tr></table></td></tr><tr><td>${emailFooter()}</td></tr></table></td></tr></table></body></html>`,
  };
}
