import { describe, expect, it, vi } from "vitest";
import { runScheduledCommand } from "./cron-cli";

describe("standalone notification runners", () => {
  it("imports both tsx entrypoints without executing a job or loading server-only", async () => {
    await expect(import("../../../scripts/send-inactivity-reminders")).resolves.toHaveProperty("main");
    await expect(import("../../../scripts/send-weekly-task-digests")).resolves.toHaveProperty("main");
  });

  it("reports a schedule skip, disconnects, and performs no delivery", async () => {
    const job = vi.fn().mockResolvedValue({ queued: 0, skippedSchedule: true });
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();
    const exitCode = await runScheduledCommand({ job, disconnect, log, processedMessage: String, failureMessage: "Fehler" });
    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith("Kein geplanter Ausführungszeitpunkt.");
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("returns a failing exit code and still disconnects", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();
    const exitCode = await runScheduledCommand({ job: vi.fn().mockRejectedValue(new Error("database unavailable")), disconnect, logError, processedMessage: String, failureMessage: "Job fehlgeschlagen." });
    expect(exitCode).toBe(1);
    expect(logError).toHaveBeenCalledWith("Job fehlgeschlagen.");
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
