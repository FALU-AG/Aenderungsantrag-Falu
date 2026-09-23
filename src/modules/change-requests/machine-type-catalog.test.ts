import { describe, expect, it } from "vitest";
import {
  machineCodeFingerprint,
  machineCodeSchema,
  normalizeMachineCode,
  resolveMachineCode,
  retiredMachineMessage,
} from "./machine-type-catalog";

const catalogue = [
  { id: "wr600v", code: "WR-600 V", active: true },
  { id: "wr2100s", code: "WR-2100 S", active: true },
  { id: "sqb2a", code: "SQB-2A", active: false },
];

describe("Schreibweise eines Maschinentyps", () => {
  it("vereinheitlicht Gross-/Kleinschreibung und Leerzeichen", () => {
    expect(normalizeMachineCode("  wr-600   v ")).toBe("WR-600 V");
    expect(normalizeMachineCode("cs-2500")).toBe("CS-2500");
  });

  it("nimmt die Zeichen an, die im heutigen Katalog vorkommen", () => {
    for (const code of ["WR-2100 S", "SV2-S", "BV-2A", "CS-2500", "VP-2", "PMS", "WR-3000"]) {
      expect(machineCodeSchema.parse(code)).toBe(code);
    }
  });

  it("weist Leeres, Überlanges und Sonderzeichen ab", () => {
    for (const bad of ["", "   ", "WR-600; DROP", "WR_600", "Ä-1", "W".repeat(31)]) {
      expect(machineCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("Erkennung bereits vorhandener Maschinen", () => {
  it("hält Trennzeichen für unerheblich", () => {
    expect(machineCodeFingerprint("WR-600 V")).toBe(machineCodeFingerprint("wr600v"));
    expect(machineCodeFingerprint("WR 600 V")).toBe(machineCodeFingerprint("WR-600V"));
  });

  // Genau der Fall aus Linas Frage: die Variante ohne V ist eine andere Maschine.
  it("unterscheidet die Variante vom Grundtyp", () => {
    expect(machineCodeFingerprint("WR-600")).not.toBe(machineCodeFingerprint("WR-600 V"));
  });

  it("wählt einen vorhandenen aktiven Typ aus, statt ihn zu verdoppeln", () => {
    const outcome = resolveMachineCode("wr600 v", catalogue);
    expect(outcome).toEqual({ kind: "existing", entry: catalogue[0] });
  });

  it("legt einen wirklich neuen Typ an", () => {
    expect(resolveMachineCode("wr-3000", catalogue)).toEqual({ kind: "create", code: "WR-3000" });
    expect(resolveMachineCode("WR-600", catalogue)).toEqual({ kind: "create", code: "WR-600" });
  });

  it("legt einen stillgelegten Typ nicht heimlich neu an", () => {
    const outcome = resolveMachineCode("sqb 2a", catalogue);
    expect(outcome.kind).toBe("retired");
    if (outcome.kind !== "retired") throw new Error("unerwartet");
    expect(retiredMachineMessage(outcome.entry)).toContain("SQB-2A");
    expect(retiredMachineMessage(outcome.entry)).toContain("stillgelegt");
  });
});
