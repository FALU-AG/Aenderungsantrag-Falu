import { z } from "zod";

/**
 * Machine types used to exist only as SQL migrations, so a machine nobody had thought of
 * blocked the whole request: at least one type is mandatory and there is no free-text escape.
 * They can now be added from the selection itself, by anyone who may write a request.
 *
 * What keeps the list usable is not a permission but the two rules below. The catalogue is
 * effectively append-only — a type a request references can never be deleted, only retired
 * (schema.prisma, onDelete: Restrict) — so a careless entry stays visible forever.
 */
export const MACHINE_CODE_MAX = 30;

export const machineCodeSchema = z
  .string()
  .transform(normalizeMachineCode)
  .pipe(
    z
      .string()
      .min(1, "Bitte einen Maschinentyp eingeben.")
      .max(MACHINE_CODE_MAX, `Der Maschinentyp darf höchstens ${MACHINE_CODE_MAX} Zeichen enthalten.`)
      .regex(/^[A-Z0-9][A-Z0-9 .\-/]*$/, "Erlaubt sind Buchstaben, Ziffern, Leerzeichen, Punkt, Bindestrich und Schrägstrich."),
  );

/** Upper case, no leading/trailing space, never two spaces in a row. */
export function normalizeMachineCode(input: string) {
  return input.trim().replace(/\s+/g, " ").toLocaleUpperCase("de-CH");
}

/**
 * Ignores every separator, so WR-600, WR 600 and WR600 are recognised as the same machine
 * while WR-600 and WR-600 V stay apart — the difference that actually matters here.
 */
export function machineCodeFingerprint(code: string) {
  return normalizeMachineCode(code).replace(/[^A-Z0-9]/g, "");
}

export type CatalogEntry = { id: string; code: string; active: boolean };

export type MachineCodeOutcome =
  | { kind: "existing"; entry: CatalogEntry }
  | { kind: "retired"; entry: CatalogEntry }
  | { kind: "create"; code: string };

/**
 * A match that is still active is simply selected instead of duplicated. A retired match is
 * refused: somebody took that machine out of the list on purpose, and undoing that is a
 * decision about the catalogue, not something to happen as a side effect of writing a request.
 */
export function resolveMachineCode(code: string, catalogue: readonly CatalogEntry[]): MachineCodeOutcome {
  const normalized = normalizeMachineCode(code);
  const fingerprint = machineCodeFingerprint(normalized);
  const match = catalogue.find((entry) => machineCodeFingerprint(entry.code) === fingerprint);
  if (!match) return { kind: "create", code: normalized };
  return match.active ? { kind: "existing", entry: match } : { kind: "retired", entry: match };
}

export function retiredMachineMessage(entry: CatalogEntry) {
  return `„${entry.code}" steht bereits im Katalog, wurde aber stillgelegt. Bitte AVOR bitten, den Typ wieder zu aktivieren.`;
}
