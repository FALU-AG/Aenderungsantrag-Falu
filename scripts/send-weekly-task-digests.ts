import { runWeeklyTaskDigests } from "../src/modules/notifications/scheduled";
import { runScheduledCommand } from "../src/modules/notifications/cron-cli";
import { db } from "../src/server/db/client";

export function main() {
  return runScheduledCommand({
    job: runWeeklyTaskDigests,
    disconnect: () => db.$disconnect(),
    processedMessage: (queued) => `${queued} Wochenübersicht(en) verarbeitet.`,
    failureMessage: "Wochenübersichten konnten nicht verarbeitet werden.",
  });
}

if (process.argv[1]?.endsWith("send-weekly-task-digests.ts")) {
  void main().then((exitCode) => { process.exitCode = exitCode; });
}
