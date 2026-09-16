import { runScheduledCommand } from "../src/modules/notifications/cron-cli";
import { runWeeklyDigest } from "../src/modules/notifications/scheduled";
import { db } from "../src/server/db/client";

export function main() {
  return runScheduledCommand({
    job: runWeeklyDigest,
    disconnect: () => db.$disconnect(),
    processedMessage: (queued) => `${queued} persönliche Wochenübersicht(en) verarbeitet.`,
    failureMessage: "Persönliche Wochenübersichten konnten nicht verarbeitet werden.",
  });
}

if (process.argv[1]?.endsWith("send-weekly-digest.ts")) {
  void main().then((exitCode) => { process.exitCode = exitCode; });
}
