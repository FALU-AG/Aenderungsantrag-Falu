import { describe, expect, it, vi } from "vitest";
import {
  ensureDevelopmentServer,
  isApplicationReady,
} from "../../../scripts/dev-server.mjs";

describe("Entwicklungsserver-Wiederherstellung", () => {
  it("erkennt einen antwortenden Server", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await expect(isApplicationReady(fetchImpl as typeof fetch)).resolves.toBe(
      true,
    );
  });

  it("startet keinen zweiten Server, wenn die Anwendung bereits läuft", async () => {
    const start = vi.fn();
    await expect(
      ensureDevelopmentServer({
        ready: vi.fn().mockResolvedValue(true),
        start,
      }),
    ).resolves.toEqual({ started: false, url: "http://localhost:3000" });
    expect(start).not.toHaveBeenCalled();
  });

  it("meldet einen fremden Prozess auf Port 3000", async () => {
    await expect(
      ensureDevelopmentServer({
        ready: vi.fn().mockResolvedValue(false),
        portInUse: vi.fn().mockResolvedValue(true),
        start: vi.fn(),
      }),
    ).rejects.toThrow("Port 3000 ist belegt");
  });

  it("startet einmal und wartet auf Bereitschaft", async () => {
    const start = vi.fn();
    const ready = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(
      ensureDevelopmentServer({
        ready,
        portInUse: vi.fn().mockResolvedValue(false),
        start,
        wait: vi.fn(),
        attempts: 3,
      }),
    ).resolves.toEqual({ started: true, url: "http://localhost:3000" });
    expect(start).toHaveBeenCalledOnce();
  });
});
