// Löscht benannte Änderungsanträge endgültig, samt ihrer Anhänge im Speicher.
//
//   npm run db:delete-test-requests -- CR-2026-001             (Probelauf, ändert nichts)
//   npm run db:delete-test-requests -- --execute CR-2026-001   (löscht endgültig)
//
// Gedacht für Testanträge, die der Workflow nicht mehr hergibt: Sobald eine fachliche
// Freigabe erteilt wurde, sperrt die Anwendung das Löschen über die Oberfläche bewusst.
//
// Nichts ist vorbelegt. Jede Nummer muss ausgeschrieben werden, gefunden werden muss
// exakt diese Menge, und ohne --execute wird nur gezählt, nie gelöscht.
import { deleteTestChangeRequests, formatTestRequestCleanup } from "../src/modules/maintenance/test-request-cleanup";
import { db } from "../src/server/db/client";

const args = process.argv.slice(2);
const execute = args[0] === "--execute";
const numbers = execute || args[0] === "--dry-run" ? args.slice(1) : args;

async function main() {
  if (!numbers.length)
    throw new Error("Abbruch: Antragsnummer angeben, z. B. --execute CR-2026-001. Ohne --execute läuft ein Probelauf.");
  const result = await deleteTestChangeRequests(db, numbers, execute);
  console.log(formatTestRequestCleanup(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Testantrag-Bereinigung fehlgeschlagen.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
