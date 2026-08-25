import { deleteTestChangeRequests, formatTestRequestCleanup } from "../src/modules/maintenance/test-request-cleanup";
import { db } from "../src/server/db/client";

const args = process.argv.slice(2);
const execute = args[0] === "--execute";
const validDryRun = args.length === 0 || (args.length === 1 && args[0] === "--dry-run");
const validExecution = execute && args.length === 3 && args[1] === "CR-2026-028" && args[2] === "CR-2026-029";

async function main() {
  if (!validDryRun && !validExecution)
    throw new Error("Abbruch: erlaubt sind nur --dry-run oder --execute CR-2026-028 CR-2026-029.");
  const result = await deleteTestChangeRequests(db, execute);
  console.log(formatTestRequestCleanup(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Testantrag-Bereinigung fehlgeschlagen.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
