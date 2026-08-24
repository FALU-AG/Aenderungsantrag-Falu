import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Maschinentyp-Migration", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260824100000_change_request_machine_types/migration.sql"), "utf8");

  it("kopiert jede historische Einzelzuordnung und verifiziert den Bestand", () => {
    expect(sql).toContain('INSERT INTO "ChangeRequestMachineType"');
    expect(sql).toContain('WHERE "machineTypeId" IS NOT NULL');
    expect(sql).toContain("Machine type migration verification failed");
  });

  it("entfernt die alte Spalte in dieser sicheren ersten Stufe nicht", () => {
    expect(sql).not.toMatch(/DROP\s+COLUMN\s+"machineTypeId"/i);
  });
});
