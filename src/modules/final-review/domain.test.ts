import { describe, expect, it } from "vitest";
import {
  blockingClosureTaskCount,
  canClose,
  canFinalApprove,
  canReopenClosed,
  closurePrerequisites,
  closedMetadata,
  finalAudit,
  nextFinalReviewCycle,
  isClosedReadOnly,
  reasonSchema,
  shouldCloseOnce,
} from "./domain";
const ready = {
  technicalCompleted: true,
  avorCompleted: true,
  purchasingCompleted: true,
  blockingTasks: 0,
};
describe("Abschlussprüfung", () => {
  it("trennt AVOR und Technik", () => {
    expect(canFinalApprove({ roles: ["EMPLOYEE"] }, "AVOR")).toBe(false);
    expect(canFinalApprove({ roles: ["AVOR"] }, "AVOR")).toBe(true);
    expect(canFinalApprove({ roles: ["TECHNICAL"] }, "TECHNICAL")).toBe(true);
    expect(canFinalApprove({ roles: ["ADMINISTRATOR"] }, "AVOR")).toBe(true);
  });
  it("schliesst erst mit beiden Freigaben", () => {
    expect(canClose(ready, ["AVOR"])).toBe(false);
    expect(canClose(ready, ["AVOR", "TECHNICAL"])).toBe(true);
  });
  it("blockiert offene Pflichtaufgaben, nicht erledigte oder optionale werden vorher herausgefiltert", () =>
    expect(
      canClose({ ...ready, blockingTasks: 1 }, ["AVOR", "TECHNICAL"]),
    ).toBe(false));
  it("zeigt alle Voraussetzungen", () =>
    expect(closurePrerequisites(ready).every((x) => x.satisfied)).toBe(true));
  it("verlangt Gründe", () =>
    expect(reasonSchema.safeParse({ reason: "" }).success).toBe(false));
  it("erhöht Zyklen und bewahrt Audittexte", () => {
    expect(nextFinalReviewCycle(1)).toBe(2);
    expect(
      finalAudit("REOPENED", "Admin", undefined, "Korrektur").summary,
    ).toContain("Korrektur");
  });
  it("lässt nur Admin geschlossene Anträge öffnen", () => {
    expect(canReopenClosed({ roles: ["ADMINISTRATOR"] })).toBe(true);
    expect(canReopenClosed({ roles: ["AVOR"] })).toBe(false);
  });
  it("ignoriert optionale und erledigte Aufgaben als Blocker", () =>
    expect(
      blockingClosureTaskCount([
        { requiredForClosure: false, status: "OPEN" },
        { requiredForClosure: true, status: "DONE" },
        { requiredForClosure: true, status: "BLOCKED" },
      ]),
    ).toBe(1));
  it("speichert Abschlussmetadaten", () => {
    const now = new Date();
    expect(closedMetadata("u1", now)).toEqual({
      status: "CLOSED",
      closedAt: now,
      closedById: "u1",
    });
  });
  it("macht geschlossene Anträge schreibgeschützt und schliesst nur einmal", () => {
    expect(isClosedReadOnly("CLOSED")).toBe(true);
    expect(shouldCloseOnce("FINAL_REVIEW", true)).toBe(true);
    expect(shouldCloseOnce("CLOSED", true)).toBe(false);
  });
});
