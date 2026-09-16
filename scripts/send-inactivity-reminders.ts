import { runInactivityReminders } from "../src/modules/notifications/scheduled";
import { runScheduledCommand } from "../src/modules/notifications/cron-cli";
import { db } from "../src/server/db/client";

export function main() {
  return runScheduledCommand({
    job: runInactivityReminders,
    disconnect: () => db.$disconnect(),
    processedMessage: (queued) => `${queued} Inaktivitätserinnerung(en) verarbeitet.`,
    failureMessage: "Inaktivitätserinnerungen konnten nicht verarbeitet werden.",
  });
}

if (process.argv[1]?.endsWith("send-inactivity-reminders.ts")) {
  void main().then((exitCode) => { process.exitCode = exitCode; });
}
