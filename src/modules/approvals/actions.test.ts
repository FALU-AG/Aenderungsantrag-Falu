import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), transaction: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/db/client", () => ({ db: { $transaction: mocks.transaction } }));

import { decideApproval } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "technical-1", name: "Thomas Technik", roles: ["TECHNICAL"] });
});

describe("Freigabeaktionen", () => {
  it("beendet nach Technik-Ablehnung den Antrag und lässt AVOR historisch offen", async () => {
    const request = { status: "UNDER_REVIEW", approvalCycle: 2 };
    const approvals = [
      { id: "avor", type: "AVOR", status: "PENDING", cycle: 2 },
      { id: "technical", type: "TECHNICAL", status: "PENDING", cycle: 2 },
    ];
    const tx = {
      changeRequest: {
        findUniqueOrThrow: vi.fn(async () => request),
        updateMany: vi.fn(async () => { request.status = "CHANGES_REQUESTED"; return { count: 1 }; }),
      },
      approval: {
        findUniqueOrThrow: vi.fn(async () => approvals[1]),
        updateMany: vi.fn(async ({ data }: { data: { status: string } }) => { approvals[1].status = data.status; return { count: 1 }; }),
        findMany: vi.fn(async () => approvals.map(({ status }) => ({ status }))),
      },
      auditEvent: { create: vi.fn() },
    };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const form = new FormData(); form.set("decision", "REJECTED"); form.set("comment", "Bitte überarbeiten");
    expect(await decideApproval("cr-1", "TECHNICAL", {}, form)).toEqual({ success: true });
    expect(request.status).toBe("CHANGES_REQUESTED");
    expect(approvals[0].status).toBe("PENDING");
    expect(approvals[1].status).toBe("REJECTED");
  });

  it("weist Entscheidungen gegen einen bereits zurückgewiesenen Antrag weiterhin serverseitig ab", async () => {
    const tx = { changeRequest: { findUniqueOrThrow: vi.fn(async () => ({ status: "CHANGES_REQUESTED", approvalCycle: 2 })) } };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    const form = new FormData(); form.set("decision", "APPROVED");
    expect(await decideApproval("cr-1", "TECHNICAL", {}, form)).toEqual({ error: "Der Antrag befindet sich nicht mehr in Prüfung." });
  });
});
