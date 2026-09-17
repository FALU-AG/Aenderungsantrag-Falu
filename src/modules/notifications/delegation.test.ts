import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queue: vi.fn(), send: vi.fn(), audit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ db: { auditEvent: { create: mocks.audit } } }));
vi.mock("./repository", () => ({ queueNotification: mocks.queue }));
vi.mock("./service-core", () => ({ sendNotification: mocks.send }));
vi.mock("@/lib/app-paths", () => ({ absoluteAppUrl: (path: string) => `https://admin.falu.com/aenderungsantrag${path}` }));

import { delegationNotificationData, notifyDelegation } from "./delegation";

const input = {
  delegationId: "d1",
  event: "CREATED" as const,
  delegatingUser: { id: "owner", name: "Florian Kaufmann" },
  substitute: { id: "sub", name: "Max Bodmer", email: "max@falu.ch" },
  scope: "TECHNICAL_APPROVAL" as const,
  startsAt: new Date("2026-09-21T00:00:00Z"),
  endsAt: new Date("2026-10-04T00:00:00Z"),
  auditActorId: "owner",
};

describe("delegation Slack notifications", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.queue.mockResolvedValue({ id: "n1" }); mocks.send.mockResolvedValue(true); mocks.audit.mockResolvedValue({ id: "audit-1" }); });
  it("queues creation for the substitute with delegator, period, scope and inbox link", async () => {
    await expect(notifyDelegation(input)).resolves.toBe(true);
    expect(mocks.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ recipientEmail: "max@falu.ch", subject: "Stellvertretung eingerichtet", templateData: expect.objectContaining({ delegatorName: "Florian Kaufmann", period: "21.09.2026 – 04.10.2026", scope: "Technische Freigaben", detail: expect.stringContaining("Meine Aufgaben"), url: "https://admin.falu.com/aenderungsantrag/meine-aufgaben" }) }));
  });
  it("uses the AVOR label and updated event", () => { expect(delegationNotificationData({ ...input, event: "UPDATED", scope: "AVOR_APPROVAL" })).toMatchObject({ heading: "Stellvertretung aktualisiert", scope: "AVOR-Freigaben" }); });
  it("notifies old and new substitutes through distinct replacement/update events", async () => {
    await notifyDelegation({ ...input, event: "UPDATED", substitute: { id: "new", name: "Neu", email: "new@falu.ch" } });
    await notifyDelegation({ ...input, event: "REPLACED" });
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.queue.mock.calls.map((call) => call[1].recipientEmail)).toEqual(["new@falu.ch", "max@falu.ch"]);
    expect(mocks.queue.mock.calls[1][1].templateData.detail).toContain("keine weiteren Freigaben");
  });
  it("sends a short cancellation notification", async () => { await notifyDelegation({ ...input, event: "CANCELLED" }); expect(mocks.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ subject: "Stellvertretung aufgehoben", templateData: expect.objectContaining({ detail: expect.stringContaining("aufgehoben") }) })); });
  it("does not propagate Slack delivery failure after the authoritative save", async () => { mocks.send.mockResolvedValue(false); await expect(notifyDelegation(input)).resolves.toBe(false); });
  it("records queue failures safely without throwing", async () => { mocks.queue.mockRejectedValue(new Error("Slack lookup failed")); await expect(notifyDelegation(input)).resolves.toBe(false); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "DELEGATION_NOTIFICATION_FAILED" }) })); });
});
