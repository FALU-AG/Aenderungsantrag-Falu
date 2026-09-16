import { retryMissingCompletionSummaries } from "../src/modules/notifications/completion-summary";
import { db } from "../src/server/db/client";

retryMissingCompletionSummaries()
  .then((results) => {
    const completed = results.filter(({ status }) => status === "completed").length;
    const failed = results.filter(({ status }) => status === "failed").length;
    console.log(`${completed} Abschlusszusammenfassung(en) verarbeitet, ${failed} fehlgeschlagen.`);
    if (failed > 0) process.exitCode = 1;
  })
  .catch(() => {
    console.error("Abschlusszusammenfassungen konnten nicht erneut verarbeitet werden.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
