import { describe, expect, it } from "vitest";
import { CHANGE_REQUEST_STATUSES, STATUS_LABELS } from "./status";

describe("Workflowstatus", () => {
  it("enthält die neun vereinbarten Hauptstatus in Reihenfolge", () => {
    expect(CHANGE_REQUEST_STATUSES).toHaveLength(9);
    expect(CHANGE_REQUEST_STATUSES[0]).toBe("DRAFT");
    expect(CHANGE_REQUEST_STATUSES.at(-1)).toBe("CLOSED");
  });

  it("bildet die Rückweisung als Änderung erforderlich ab", () => {
    expect(STATUS_LABELS.CHANGES_REQUESTED).toBe("Änderung erforderlich");
  });
});
