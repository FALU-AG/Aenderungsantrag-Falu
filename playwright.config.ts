import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  // The browser talks to the harness, which stands in for the portal and the Cloudflare
  // adapter: it mints a request-bound assertion and forwards to the application, exactly as
  // the public host does in production. The application is not reachable directly any more.
  use: { baseURL: "http://127.0.0.1:3100/aenderungsantrag/", trace: "on-first-retry" },
  webServer: { command: "npx tsx e2e/harness.ts", url: "http://127.0.0.1:3100/login", reuseExistingServer: true, timeout: 180_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
