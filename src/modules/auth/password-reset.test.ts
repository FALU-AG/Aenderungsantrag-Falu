import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/server/db/client", () => ({ db: { passwordResetToken: { findUnique } } }));
vi.mock("@/modules/notifications/service", () => ({ sendNotification: vi.fn() }));
import { hashResetToken, isPasswordResetTokenUsable } from "./password-reset";
import { PASSWORD_RESET_TTL_MINUTES } from "@/modules/notifications/domain";
describe("password reset security", () => {
  beforeEach(() => findUnique.mockReset());
  it("stores a deterministic SHA-256 hash, not the raw token", () => { const raw = "raw-secret-reset-token"; const hash = hashResetToken(raw); expect(hash).toHaveLength(64); expect(hash).not.toContain(raw); expect(hashResetToken(raw)).toBe(hash); });
  it("uses a thirty minute validity period", () => expect(PASSWORD_RESET_TTL_MINUTES).toBe(30));
  it("accepts only active, unused and unexpired tokens", async () => { findUnique.mockResolvedValue({ usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: { active: true } }); expect(await isPasswordResetTokenUsable("valid")).toBe(true); });
  it.each([
    { usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), user: { active: true } },
    { usedAt: null, expiresAt: new Date(Date.now() - 60_000), user: { active: true } },
    { usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: { active: false } },
  ])("rejects used, expired or inactive-user tokens", async (value) => { findUnique.mockResolvedValue(value); expect(await isPasswordResetTokenUsable("invalid")).toBe(false); });
  it("rejects a missing token without querying the database", async () => { expect(await isPasswordResetTokenUsable("")).toBe(false); expect(findUnique).not.toHaveBeenCalled(); });
});
