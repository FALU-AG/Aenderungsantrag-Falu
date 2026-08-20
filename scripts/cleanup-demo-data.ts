import { cleanupDemoData, formatDemoCleanupResult } from "../src/modules/maintenance/demo-cleanup";
import { db } from "../src/server/db/client";

async function main() {
  const execute = process.argv.slice(2).includes("--execute");
  const result = await cleanupDemoData(db, execute);
  console.log(formatDemoCleanupResult(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo cleanup failed.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
