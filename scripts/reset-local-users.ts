import { formatLocalUserReset, localUserReset } from "../src/modules/maintenance/local-user-reset";
import { db } from "../src/server/db/client";

export const LOCAL_USER_RESET_USAGE = "Usage: npm run db:reset-local-users -- [--dry-run|--execute|--help]";

export async function main(args = process.argv.slice(2), environment = process.env) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(LOCAL_USER_RESET_USAGE);
    return;
  }
  const validDryRun = args.length === 0 || (args.length === 1 && args[0] === "--dry-run");
  const execute = args.length === 1 && args[0] === "--execute";
  if (!validDryRun && !execute) throw new Error(LOCAL_USER_RESET_USAGE);
  const result = await localUserReset(db, { execute, confirmation: environment.CONFIRM_LOCAL_USER_RESET });
  console.log(formatLocalUserReset(result));
}

if (process.argv[1]?.endsWith("reset-local-users.ts")) main()
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Local user reset failed."); process.exitCode = 1; })
  .finally(() => db.$disconnect());
