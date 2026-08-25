import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ db: {} }));
vi.mock("@/modules/notifications/service", () => ({ sendNotification: vi.fn() }));
import { hashResetToken } from "./password-reset";
import { PASSWORD_RESET_TTL_MINUTES } from "@/modules/notifications/domain";
describe("password reset security", () => {
  it("stores a deterministic SHA-256 hash, not the raw token", () => { const raw = "raw-secret-reset-token"; const hash = hashResetToken(raw); expect(hash).toHaveLength(64); expect(hash).not.toContain(raw); expect(hashResetToken(raw)).toBe(hash); });
  it("uses a thirty minute validity period", () => expect(PASSWORD_RESET_TTL_MINUTES).toBe(30));
});
