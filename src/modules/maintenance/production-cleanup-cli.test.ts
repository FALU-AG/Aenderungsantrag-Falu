import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production cleanup standalone CLI", () => {
  it("loads through tsx without importing the Next.js server-only boundary", () => {
    const result = spawnSync(
      process.execPath,
      [path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("scripts/production-cleanup.ts"), "--help"],
      { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: npm run production:cleanup");
    expect(result.stderr).not.toContain("This module cannot be imported from a Client Component module");
  });
});
