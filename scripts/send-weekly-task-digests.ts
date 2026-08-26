import { runWeeklyTaskDigests } from "../src/modules/notifications/scheduled";
import { db } from "../src/server/db/client";

runWeeklyTaskDigests().then(({ queued, skippedSchedule }) => console.log(skippedSchedule ? "Kein geplanter Ausführungszeitpunkt." : `${queued} Wochenübersicht(en) verarbeitet.`)).catch(() => { console.error("Wochenübersichten konnten nicht verarbeitet werden."); process.exitCode = 1; }).finally(() => db.$disconnect());
