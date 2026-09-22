vi.mock("@/modules/auth/directory",()=>({warmCentralDirectory:vi.fn(),centralUsers:vi.fn().mockResolvedValue([{id:"sub",roles:[{role:{key:"EMPLOYEE"}}]},{id:"owner",roles:[{role:{key:"AVOR"}}]}])}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), transaction: vi.fn(), revalidatePath: vi.fn(), findDelegation: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/db/client", () => ({ db: { $transaction: mocks.transaction, approvalDelegation: { findFirst: mocks.findDelegation } } }));

import { decideApproval } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "technical-1", name: "Thomas Technik", roles: ["TECHNICAL"] });
  mocks.findDelegation.mockResolvedValue(null);
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

  it("records the actual actor, represented user and delegation for a delegated decision", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "sub", name: "Max Bodmer", roles: ["EMPLOYEE"] });
    mocks.findDelegation.mockResolvedValue({ id: "delegation-1", delegatingUserId: "owner", delegatingUser: { name: "Florian Kaufmann" } });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn();
    const tx = { changeRequest: { findUniqueOrThrow: vi.fn(async()=>({status:"UNDER_REVIEW",approvalCycle:1})), updateMany: vi.fn() }, approval: { findUniqueOrThrow: vi.fn(async()=>({id:"a1",status:"PENDING"})), updateMany, findMany: vi.fn(async()=>[{status:"PENDING"},{status:"APPROVED"}]) }, auditEvent: { create: auditCreate } };
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx)=>unknown)=>callback(tx));
    const form = new FormData(); form.set("decision","APPROVED");
    expect(await decideApproval("cr-1","AVOR",{},form)).toEqual({success:true});
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({decisionUserId:"sub",representedUserId:"owner",delegationId:"delegation-1"})}));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({summary:expect.stringContaining("als Stellvertreter von Florian Kaufmann")})}));
  });
});
