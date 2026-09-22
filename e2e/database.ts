import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Throwaway database of the browser-test harness. Ignored by git, removed after each run. */
export const E2E_DATABASE_DIR = resolve(".e2e-database");
export const DATABASE_URL_FILE = resolve(E2E_DATABASE_DIR, "url");

/**
 * The specs need the same connection as the harness. It is written to a file rather than an
 * environment variable because Playwright starts the web server as a separate process and
 * cannot hand anything back to the tests.
 */
export function e2eDatabaseUrl() {
  try { return readFileSync(DATABASE_URL_FILE, "utf8").trim(); }
  catch { throw new Error("Die Testdatenbank läuft nicht. Starte die Tests über 'npm run test:e2e'."); }
}
