import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  // The application runs in development mode, so the first request to a route waits for it to
  // be compiled. That is slower than a built server, not a symptom of anything being wrong.
  timeout: 60_000,
  // The browser talks to the harness, which stands in for the portal and the Cloudflare
  // adapter: it mints a request-bound assertion and forwards to the application, exactly as
  // the public host does in production. The application is not reachable directly any more.
  use: { baseURL: "https://127.0.0.1:3100/aenderungsantrag/", ignoreHTTPSErrors: true, trace: "on-first-retry" },
  webServer: { command: "npx tsx e2e/harness.ts", url: "https://127.0.0.1:3100/login", ignoreHTTPSErrors: true, reuseExistingServer: true, timeout: 300_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
