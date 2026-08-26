import { runInactivityReminders } from "../src/modules/notifications/scheduled";
import { db } from "../src/server/db/client";

runInactivityReminders().then(({ queued, skippedSchedule }) => console.log(skippedSchedule ? "Kein geplanter Ausführungszeitpunkt." : `${queued} Inaktivitätserinnerung(en) verarbeitet.`)).catch(() => { console.error("Inaktivitätserinnerungen konnten nicht verarbeitet werden."); process.exitCode = 1; }).finally(() => db.$disconnect());
