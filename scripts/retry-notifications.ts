import { retryNotifications } from "../src/modules/notifications/service";
import { db } from "../src/server/db/client";

retryNotifications().then((count) => console.log(`${count} Benachrichtigung(en) verarbeitet.`)).catch(() => { console.error("Benachrichtigungen konnten nicht verarbeitet werden."); process.exitCode = 1; }).finally(() => db.$disconnect());
