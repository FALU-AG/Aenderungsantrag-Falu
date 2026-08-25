import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { findUnique, update } = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { emailNotification: { findUnique, update } } }));
import { sendNotification } from "./service";

const row = { id: "n1", type: "TASK_ASSIGNED", status: "PENDING", attemptCount: 0, recipientEmail: "user@falu.ch", subject: "Neue Aufgabe", idempotencyKey: "task:1", templateData: { title: "Zeichnung" } };
describe("notification delivery", () => {
  beforeEach(() => { findUnique.mockReset(); update.mockReset(); findUnique.mockResolvedValue(row); update.mockResolvedValue({}); });
  it("marks a successful delivery SENT", async () => { expect(await sendNotification("n1", { provider: { send: vi.fn().mockResolvedValue({ id: "mail-1" }) } })).toBe(true); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerMessageId: "mail-1" }) })); });
  it("records a safe retry state without throwing", async () => { expect(await sendNotification("n1", { provider: { send: vi.fn().mockRejectedValue(new Error("re_supersecret failed")) } })).toBe(false); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", lastError: expect.not.stringContaining("re_supersecret") }) })); });
  it("does not resend an already sent notification", async () => { findUnique.mockResolvedValue({ ...row, status: "SENT" }); const send = vi.fn(); expect(await sendNotification("n1", { provider: { send } })).toBe(false); expect(send).not.toHaveBeenCalled(); });
});
