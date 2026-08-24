import { describe, expect, it } from "vitest";
import { machineTypeChangeSummary } from "./machine-type-change";

describe("Maschinentyp-Audit", () => {
  it("nennt hinzugefügte und entfernte Maschinen lesbar", () => {
    expect(machineTypeChangeSummary(["SV-2X"], ["CB1"])).toBe(
      "Maschinentypen geändert. Hinzugefügt: SV-2X. Entfernt: CB1",
    );
  });
});
