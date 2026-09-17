import { describe, expect, it } from "vitest";
import {
  ADDITIONAL_TABS,
  deriveWorkflowStages,
  WORKFLOW_TABS,
} from "./navigation";

describe("chronologische Workflow-Navigation", () => {
  it("hält Workflow und zusätzliche Bereiche in der geforderten Reihenfolge getrennt", () => {
    expect(WORKFLOW_TABS).toEqual([
      "Übersicht",
      "Freigaben",
      "Technische Prüfung",
      "AVOR",
      "Einkauf",
      "Abschlussprüfung",
    ]);
    expect(ADDITIONAL_TABS).toEqual([
      "Aufgaben",
      "Anhänge",
      "Kommentare",
      "Historie",
    ]);
  });

  it("leitet aktuelle, abgeschlossene und noch nicht gestartete Stufen aus Domänendaten ab", () => {
    expect(
      deriveWorkflowStages({
        status: "UNDER_REVIEW",
        approvals: [
          { type: "AVOR", status: "PENDING" },
          { type: "TECHNICAL", status: "APPROVED" },
        ],
      }),
    ).toEqual([
      { tab: "Übersicht", state: "COMPLETED" },
      { tab: "Freigaben", state: "CURRENT" },
      { tab: "Technische Prüfung", state: "CURRENT" },
      { tab: "AVOR", state: "NOT_STARTED" },
      { tab: "Einkauf", state: "NOT_STARTED" },
      { tab: "Abschlussprüfung", state: "NOT_STARTED" },
    ]);
  });

  it("zeigt eine abgelehnte Freigaberunde als Überarbeitung erforderlich", () => {
    const stages = deriveWorkflowStages({
      status: "CHANGES_REQUESTED",
      approvals: [
        { type: "AVOR", status: "PENDING" },
        { type: "TECHNICAL", status: "REJECTED" },
      ],
    });
    expect(stages.find(({ tab }) => tab === "Freigaben")?.state).toBe(
      "REJECTED",
    );
    expect(
      stages.find(({ tab }) => tab === "Technische Prüfung")?.state,
    ).toBe("NOT_STARTED");
  });

  it("kennzeichnet nicht erforderlichen Einkauf und den geschlossenen Ablauf korrekt", () => {
    const stages = deriveWorkflowStages({
      status: "CLOSED",
      approvals: [
        { type: "AVOR", status: "APPROVED" },
        { type: "TECHNICAL", status: "APPROVED" },
      ],
      technicalReview: { completed: true },
      avorReview: { completed: true },
      purchasingReview: { completed: true, purchasingRequired: false },
    });
    expect(stages.map(({ state }) => state)).toEqual([
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "NOT_REQUIRED",
      "COMPLETED",
    ]);
  });
});
