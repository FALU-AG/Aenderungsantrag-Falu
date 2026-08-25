import type { EmailNotificationType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { renderNotification } from ".";

const workflowTypes: EmailNotificationType[] = ["USER_INVITATION", "APPROVAL_REQUIRED_AVOR", "APPROVAL_REQUIRED_TECHNICAL", "TASK_ASSIGNED", "REQUEST_CHANGES_REQUIRED", "REQUEST_APPROVED", "REQUEST_PHASE_CHANGED", "REQUEST_CLOSED"];

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
});
