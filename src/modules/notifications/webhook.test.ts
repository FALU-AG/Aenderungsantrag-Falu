import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { verify, updateMany } = vi.hoisted(() => ({ verify: vi.fn(), updateMany: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { webhooks = { verify }; } }));
vi.mock("@/server/db/client", () => ({ db: { emailNotification: { updateMany } } }));
import { applyResendWebhook, verifyResendWebhook } from "./webhook";

const headers = new Headers({ "svix-id": "id", "svix-timestamp": "time", "svix-signature": "signature" });
describe("Resend webhook", () => {
  beforeEach(() => { verify.mockReset(); updateMany.mockReset(); });
  it("accepts a valid signed raw payload", () => { verify.mockReturnValue({ type: "email.sent", data: { email_id: "mail-1" } }); expect(verifyResendWebhook("raw", headers, "whsec_test")).toEqual(expect.objectContaining({ type: "email.sent" })); expect(verify).toHaveBeenCalledWith(expect.objectContaining({ payload: "raw", webhookSecret: "whsec_test" })); });
  it("rejects missing signatures", () => expect(() => verifyResendWebhook("raw", new Headers(), "whsec_test")).toThrow("Signatur"));
  it("updates delivery and bounce states by provider id", async () => { updateMany.mockResolvedValue({ count: 1 }); await applyResendWebhook({ type: "email.delivered", created_at: "2026-01-01", data: { email_id: "mail-1", created_at: "2026-01-01", message_id: "message", from: "a@b.ch", to: ["c@d.ch"], subject: "x" } }); expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { providerMessageId: "mail-1" }, data: { status: "DELIVERED" } })); });
});
