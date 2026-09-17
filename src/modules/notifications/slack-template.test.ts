import { describe, expect, it } from "vitest";
import { renderSlackNotification } from "./slack-template";

describe("Slack notification presentation", () => {
  it("renders a delegation message with period, scope and application action", () => {
    const rendered = renderSlackNotification("REQUEST_PHASE_CHANGED", "Stellvertretung eingerichtet", { delegationEvent: "CREATED", heading: "Stellvertretung eingerichtet", delegatorName: "Florian Kaufmann", detail: "Florian Kaufmann hat dich als Stellvertreter eingetragen.", period: "21.09.2026 – 04.10.2026", scope: "Technische Freigaben", url: "https://admin.falu.com/aenderungsantrag/meine-aufgaben" });
    expect(JSON.stringify(rendered.blocks)).toContain("Florian Kaufmann");
    expect(JSON.stringify(rendered.blocks)).toContain("21.09.2026 – 04.10.2026");
    expect(JSON.stringify(rendered.blocks)).toContain("Technische Freigaben");
    expect(JSON.stringify(rendered.blocks)).toContain("FALU Change Request öffnen");
  });
  it("renders all personal weekly digest sections", () => {
    const rendered = renderSlackNotification("WEEKLY_TASK_DIGEST", "Wochenübersicht", {
      greetingName: "Anna Beispiel",
      overdue: [{ number: "CR-2026-001", title: "Zeichnung", dueDate: "14.09.2026" }],
      ownRequests: [{ number: "CR-2026-002", title: "Halterung", status: "Wartet auf AVOR-Freigabe" }],
      approvals: [{ number: "CR-2026-003", title: "Abstreifer", responsibility: "Technik-Freigabe erforderlich" }],
      url: "https://admin.falu.com/aenderungsantrag/meine-aufgaben",
    });
    expect(JSON.stringify(rendered.blocks)).toContain("Guten Morgen Anna Beispiel");
    expect(JSON.stringify(rendered.blocks)).toContain("Eigene Änderungsanträge");
    expect(JSON.stringify(rendered.blocks)).toContain("Offene Freigaben");
  });

  it("renders the stored completion summary in a company-wide close message", () => {
    const rendered = renderSlackNotification("REQUEST_CLOSED", "Abgeschlossen", {
      number: "CR-2026-041",
      title: "Optimierung Abstreifer CB1",
      applicantName: "Florian Kaufmann",
      machineTypes: "CB1, PMS",
      completionSummary: "Abstreifer ersetzt und im Betrieb getestet.",
      completedAt: "16.09.2026",
      url: "https://admin.falu.com/aenderungsantrag/change-requests/cr-1",
    });
    expect(JSON.stringify(rendered.blocks)).toContain("Abstreifer ersetzt und im Betrieb getestet.");
    expect(JSON.stringify(rendered.blocks)).toContain("16.09.2026");
    expect(JSON.stringify(rendered.blocks)).toContain("CB1, PMS");
  });
});
