import { describe, expect, it } from "vitest";
import { SAMPLE_USERS } from "./auth/sample-users";
import { CHANGE_REASONS, MACHINE_TYPES } from "./reference-data";

describe("Seed-Annahmen", () => {
  it("enthält fünf eindeutige Beispielbenutzer", () => {
    expect(SAMPLE_USERS).toHaveLength(5);
    expect(new Set(SAMPLE_USERS.map((user) => user.email)).size).toBe(5);
  });

  it("enthält alle geforderten Maschinentypen", () => {
    expect(MACHINE_TYPES.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "CB1",
        "CT",
        "CS-2500",
        "PRX",
        "SV-2X",
        "ABS",
        "BL-8",
        "BL-12",
        "BL-16",
        "BLS-12",
        "BV-2A",
        "BV-2M",
        "RB-30A",
        "SQB-2A",
        "SQB-AT",
        "SV2-S",
        "WV",
      ]),
    );
  });

  it("enthält elf deutsche Änderungsgründe mit Sonstiges", () => {
    expect(CHANGE_REASONS).toHaveLength(11);
    expect(CHANGE_REASONS.find((reason) => reason.isOther)?.label).toBe(
      "Sonstiges",
    );
    expect(CHANGE_REASONS[0].active).toBe(false);
  });
});
