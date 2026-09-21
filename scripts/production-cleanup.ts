import { formatProductionCleanup, productionCleanup, ProductionCleanupStorageError } from "../src/modules/maintenance/production-cleanup";
import { db } from "../src/server/db/client";

export async function main(args = process.argv.slice(2), environment = process.env) {
  const validDryRun = args.length === 0 || (args.length === 1 && args[0] === "--dry-run");
  const execute = args.length === 1 && args[0] === "--execute";
  if (!validDryRun && !execute) throw new Error("Allowed arguments: --dry-run or --execute.");
  const result = await productionCleanup(db, { execute, confirmation: environment.PRODUCTION_CLEANUP_CONFIRM });
  console.log(formatProductionCleanup(result));
}

if (process.argv[1]?.endsWith("production-cleanup.ts")) main().catch((error: unknown) => {
  if (error instanceof ProductionCleanupStorageError) {
    console.error(error.message);
    for (const failure of error.failures) console.error(`- Failed Storage object (${failure.provider}): ${failure.key}`);
  } else console.error(error instanceof Error ? error.message : "Production cleanup failed.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
