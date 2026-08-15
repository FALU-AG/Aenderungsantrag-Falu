import { describe, expect, it } from "vitest";
import { SAMPLE_USERS } from "./auth/sample-users";
import { CHANGE_REASONS, MACHINE_TYPES } from "./reference-data";

describe("Seed-Annahmen", () => {
  it("enthält fünf eindeutige Beispielbenutzer", () => {
    expect(SAMPLE_USERS).toHaveLength(5);
    expect(new Set(SAMPLE_USERS.map((user) => user.email)).size).toBe(5);
  });

  it("enthält die sechs geforderten Maschinentypen", () => {
    expect(MACHINE_TYPES.map((item) => item.code)).toEqual(["CB1", "CS-2500", "CT", "SV-2X", "BL-16", "ABS"]);
  });

  it("enthält elf deutsche Änderungsgründe mit Sonstiges", () => {
    expect(CHANGE_REASONS).toHaveLength(11);
    expect(CHANGE_REASONS.find((reason) => reason.isOther)?.label).toBe("Sonstiges");
  });
});
