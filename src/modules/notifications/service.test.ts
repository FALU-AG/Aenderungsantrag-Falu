vi.mock("@/modules/auth/directory",()=>({centralUser:vi.fn().mockResolvedValue({id:"u1",email:"user@falu.ch",name:"Erika Beispiel"})}));
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { findUnique, findMany, update, providerSend } = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), providerSend: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { emailNotification: { findUnique, findMany, update } } }));
vi.mock("./delivery-core", () => ({ createNotificationDeliveryProvider: () => ({ send: providerSend }) }));
import { retryNotifications, sendNotification } from "./service";

const row = { recipientUserId:"u1", id: "n1", type: "TASK_ASSIGNED", status: "PENDING", attemptCount: 0, recipientEmail: "user@falu.ch", recipientName: "Erika Beispiel", subject: "Neue Aufgabe", idempotencyKey: "task:1", templateData: { title: "Zeichnung" } };
describe("notification delivery", () => {
  beforeEach(() => { findUnique.mockReset(); findMany.mockReset(); update.mockReset(); providerSend.mockReset(); findUnique.mockResolvedValue(row); update.mockResolvedValue({}); providerSend.mockResolvedValue({id:"slack-1"}); });
  it("marks a successful delivery SENT", async () => { expect(await sendNotification("n1", { provider: { send: vi.fn().mockResolvedValue({ id: "mail-1" }) } })).toBe(true); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerMessageId: "mail-1" }) })); });
  it("records a safe retry state without failing the workflow", async () => { expect(await sendNotification("n1", { provider: { send: vi.fn().mockRejectedValue(new Error("xoxb-supersecret failed")) } })).toBe(false); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", lastError: expect.not.stringContaining("xoxb-supersecret") }) })); });
  it("does not resend an already sent notification", async () => { findUnique.mockResolvedValue({ ...row, status: "SENT" }); const send = vi.fn(); expect(await sendNotification("n1", { provider: { send } })).toBe(false); expect(send).not.toHaveBeenCalled(); });
  it("passes the centrally revalidated recipient identity through the shared delivery boundary", async () => { await sendNotification("n1"); expect(providerSend).toHaveBeenCalledWith(expect.objectContaining({recipientEmail:"user@falu.ch",recipientName:"Erika Beispiel"})); });
  it("routes retry jobs back through the same shared delivery boundary", async () => { findMany.mockResolvedValue([{id:"n1"},{id:"n2"}]); findUnique.mockImplementation(async ({where}:{where:{id:string}})=>({...row,id:where.id,idempotencyKey:`task:${where.id}`})); expect(await retryNotifications()).toBe(2); expect(providerSend).toHaveBeenCalledTimes(2); });
});
