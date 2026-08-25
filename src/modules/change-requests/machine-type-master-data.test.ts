import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "prisma/migrations/20260825130000_add_machine_types/migration.sql"), "utf8");
const codes = ["WR-2100 S", "WR-600 V", "VP-2"];

describe("Maschinentyp-Masterdatenmigration", () => {
  it("legt alle neuen Maschinentypen aktiv mit exaktem Anzeigenamen an", () => {
    for (const code of codes) expect(sql).toContain(`'${code}', '${code}', true`);
  });

  it("ist über den eindeutigen Code idempotent und erhält bestehende Datensätze", () => {
    expect(sql).toContain('ON CONFLICT ("code") DO UPDATE');
    expect(sql).toContain('"active" = true');
    expect(sql).not.toMatch(/DELETE|TRUNCATE|DROP/i);
  });
});
