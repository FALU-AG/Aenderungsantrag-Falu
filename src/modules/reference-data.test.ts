import { describe, expect, it } from "vitest";
import { SAMPLE_USERS } from "./auth/sample-users";
import { CHANGE_REASONS, MACHINE_TYPES } from "./reference-data";

describe("Seed-Annahmen", () => {
  it("enthält fünf eindeutige Beispielbenutzer", () => {
    expect(SAMPLE_USERS).toHaveLength(5);
    expect(new Set(SAMPLE_USERS.map((user) => user.email)).size).toBe(5);
  });

  it("stellt nur die korrigierten Maschinentypen für neue Anträge bereit", () => {
    const active = MACHINE_TYPES.filter((item) => item.active).map((item) => item.code);
    expect(active).toContain("SQB-2AT");
    expect(active).toEqual(expect.arrayContaining(["WR-2100 S", "WR-600 V", "VP-2"]));
    for (const code of ["WR-2100 S", "WR-600 V", "VP-2"])
      expect(MACHINE_TYPES.find((item) => item.code === code)).toEqual({ code, name: code, active: true });
    expect(active).not.toEqual(expect.arrayContaining(["BLS-12", "SQB-2A", "SQB-AT", "SQT-AT"]));
    expect(MACHINE_TYPES.find((item) => item.code === "SQB-AT")?.active).toBe(false);
    expect(MACHINE_TYPES.find((item) => item.code === "SQT-AT")?.active).toBe(false);
    expect(MACHINE_TYPES.filter((item) => ["BLS-12", "SQB-2A", "SQB-AT", "SQT-AT"].includes(item.code)).every((item) => !item.active)).toBe(true);
  });

  it("behält alte Maschinentypen inaktiv für historische Referenzen", () => {
    expect(MACHINE_TYPES.find((item) => item.code === "BLS-12")).toMatchObject({ active: false });
  });

  it("enthält elf deutsche Änderungsgründe mit Sonstiges", () => {
    expect(CHANGE_REASONS).toHaveLength(11);
    expect(CHANGE_REASONS.find((reason) => reason.isOther)?.label).toBe(
      "Sonstiges",
    );
    expect(CHANGE_REASONS[0].active).toBe(false);
  });
});
