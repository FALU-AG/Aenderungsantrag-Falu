import type { EmailNotificationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { renderNotification } from ".";

const workflowTypes: EmailNotificationType[] = ["USER_INVITATION", "APPROVAL_REQUIRED_AVOR", "APPROVAL_REQUIRED_TECHNICAL", "TASK_ASSIGNED", "REQUEST_CHANGES_REQUIRED", "REQUEST_APPROVED", "REQUEST_PHASE_CHANGED", "REQUEST_CLOSED", "REQUEST_INACTIVITY_REMINDER"];

describe("notification templates", () => {
  it("renders a branded password-reset CTA, security guidance and complete fallback URL", () => {
    const url = "https://app.example/reset-password?token=complete-secure-token-123456789";
    const result = renderNotification("PASSWORD_RESET", "Passwort zurücksetzen | FALU Change Request", { url });
    expect(result.html).toContain("FALU AG");
    expect(result.html).toContain("Passwort neu setzen");
    expect(result.html).toContain("Falls der Button nicht funktioniert");
    expect(result.html).toContain(url);
    expect(result.html).toContain("30 Minuten");
    expect(result.text).toContain(`Passwort neu setzen:\n${url}`);
    expect(result.text).toContain("nur einmal verwendet");
  });

  it.each(workflowTypes)("uses the shared branded table layout for %s", (type) => {
    const result = renderNotification(type, "Transaktionale Nachricht", { number: "CR-2026-031", title: "Signalampel", machineTypes: "SV-2X, RB-30A", applicantName: "Florian Kaufmann", url: "https://app.example/change-requests/1" });
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain("FALU AG");
    expect(result.html).toContain("Change Request");
    expect(result.html).toContain("Maschinentypen");
    expect(result.html).toContain("SV-2X, RB-30A");
    expect(result.text).toContain("CR-2026-031");
  });

  it("preserves long actionable URLs in HTML and plaintext", () => {
    const url = `https://app.example/change-requests/${"a".repeat(180)}?tab=Freigaben`;
    const result = renderNotification("APPROVAL_REQUIRED_AVOR", "Freigabe", { url });
    expect(result.html).toContain(url);
    expect(result.html).toContain("word-break:break-all");
    expect(result.text).toContain(url);
  });

  it("escapes internal values in HTML", () => expect(renderNotification("TASK_ASSIGNED", "Aufgabe", { detail: "<script>" }).html).not.toContain("<script>"));

  it("renders all digest groups and direct task links in one branded email", () => {
    const item = { title: "Zeichnung aktualisieren", number: "CR-2026-025", requestTitle: "Riemenspanner", priority: "Hoch", dueDate: "21.08.2026", status: "Offen", url: "https://app.example/change-requests/1?tab=Aufgaben#task-1" };
    const result = renderNotification("WEEKLY_TASK_DIGEST", "Digest", { openCount: 3, overdueCount: 1, dueThisWeekCount: 1, overdue: [item], dueThisWeek: [{ ...item, title: "Bestellung prüfen" }], other: [{ ...item, title: "Dokumentation" }], url: "https://app.example/meine-aufgaben" });
    expect(result.html).toContain("Überfällig");
    expect(result.html).toContain("Diese Woche fällig");
    expect(result.html).toContain("Weitere offene Aufgaben");
    expect(result.html).toContain(item.url);
    expect(result.text).toContain("Zeichnung aktualisieren");
  });
});
