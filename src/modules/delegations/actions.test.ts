vi.mock("@/modules/auth/directory",()=>({centralUser:(id:string)=>mocks.findUser({where:{id}})}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), transaction: vi.fn(), findUser: vi.fn(), findUserOrThrow: vi.fn(), findOverlap: vi.fn(), findDelegation: vi.fn(), notify: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/notifications/delegation", () => ({ notifyDelegation: mocks.notify }));
vi.mock("@/modules/notifications/workflow", () => ({ queueApprovalCycleNotifications: vi.fn() }));
vi.mock("@/modules/notifications/service", () => ({ sendNotifications: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: {
  user: { findUnique: mocks.findUser, findUniqueOrThrow: mocks.findUserOrThrow },
  approvalDelegation: { findFirst: mocks.findOverlap, findUniqueOrThrow: mocks.findDelegation },
  changeRequest: { findMany: vi.fn().mockResolvedValue([]) },
  $transaction: mocks.transaction,
} }));

import { cancelDelegation, createDelegation, updateDelegation } from "./actions";

const form = (scope = "AVOR_APPROVAL", substitute = "sub") => { const data = new FormData(); data.set("substituteUserId", substitute); data.set("scope", scope); data.set("startsAt", "2027-09-21T08:00"); data.set("endsAt", "2027-10-04T17:00"); return data; };
const owner = (role: "AVOR" | "TECHNICAL") => ({ active: true, roles: [{ role: { key: role } }] });

describe("delegation server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOverlap.mockResolvedValue(null);
    mocks.findUser.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "sub" ? { active: true } : owner("AVOR"));
    mocks.findUserOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "sub" ? { id: "sub", name: "Max", email: "max@falu.ch" } : { id: where.id, name: "Florian" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({ approvalDelegation: { create: vi.fn().mockResolvedValue({ id: "d1" }), update: vi.fn() }, auditEvent: { create: vi.fn() } }));
    mocks.notify.mockResolvedValue(true);
  });
  it("rejects EMPLOYEE-only self-service before database mutation", async () => { mocks.currentUser.mockResolvedValue({ id: "employee", name: "Erika", roles: ["EMPLOYEE"] }); await expect(createDelegation(form())).rejects.toThrow("nicht delegieren"); expect(mocks.transaction).not.toHaveBeenCalled(); });
  it("allows AVOR to delegate AVOR and sends the substitute notification", async () => { mocks.currentUser.mockResolvedValue({ id: "avor", name: "Florian", roles: ["AVOR"] }); await createDelegation(form()); expect(mocks.transaction).toHaveBeenCalled(); expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ event: "CREATED", scope: "AVOR_APPROVAL", substitute: expect.objectContaining({ id: "sub" }) })); });
  it("allows Technical to delegate Technical", async () => { mocks.currentUser.mockResolvedValue({ id: "tech", name: "Theo", roles: ["TECHNICAL"] }); mocks.findUser.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "sub" ? { active: true } : owner("TECHNICAL")); await createDelegation(form("TECHNICAL_APPROVAL")); expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ scope: "TECHNICAL_APPROVAL" })); });
  it("rejects a scope the user does not possess", async () => { mocks.currentUser.mockResolvedValue({ id: "avor", name: "Florian", roles: ["AVOR"] }); await expect(createDelegation(form("TECHNICAL_APPROVAL"))).rejects.toThrow("nicht delegieren"); });
  it("allows an administrator to manage another role holder", async () => { mocks.currentUser.mockResolvedValue({ id: "admin", name: "Admin", roles: ["ADMINISTRATOR"] }); const data=form(); data.set("delegatingUserId","avor"); await createDelegation(data); expect(mocks.transaction).toHaveBeenCalled(); });
  it("keeps the created delegation when Slack delivery fails", async () => { mocks.currentUser.mockResolvedValue({ id: "avor", name: "Florian", roles: ["AVOR"] }); mocks.notify.mockResolvedValue(false); await expect(createDelegation(form())).resolves.toBeUndefined(); expect(mocks.transaction).toHaveBeenCalled(); });
  it("does not update, audit or notify a no-op edit", async () => {
    mocks.currentUser.mockResolvedValue({ id: "avor", name: "Florian", roles: ["AVOR"] });
    mocks.findDelegation.mockResolvedValue({ id:"d1", delegatingUserId:"avor", substituteUserId:"sub", scope:"AVOR_APPROVAL", startsAt:new Date("2027-09-21T06:00:00Z"), endsAt:new Date("2027-10-04T15:00:00Z"), enabled:true, delegatingUser:{id:"avor",name:"Florian"}, substituteUser:{id:"sub",name:"Max",email:"max@falu.ch"} });
    await updateDelegation("d1", form());
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("notifies the new substitute and releases the previous substitute after replacement", async () => {
    mocks.currentUser.mockResolvedValue({ id: "avor", name: "Florian", roles: ["AVOR"] });
    const existing={ id:"d1", delegatingUserId:"avor", substituteUserId:"sub", scope:"AVOR_APPROVAL", startsAt:new Date("2027-09-21T06:00:00Z"), endsAt:new Date("2027-10-04T15:00:00Z"), enabled:true, delegatingUser:{id:"avor",name:"Florian"}, substituteUser:{id:"sub",name:"Max",email:"max@falu.ch"} } as const;
    mocks.findDelegation.mockResolvedValue(existing);
    mocks.findUser.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === "avor" ? owner("AVOR") : { active: true });
    mocks.findUserOrThrow.mockResolvedValue({ id:"new",name:"Neu",email:"new@falu.ch" });
    await updateDelegation("d1", form("AVOR_APPROVAL","new"));
    expect(mocks.notify).toHaveBeenNthCalledWith(1,expect.objectContaining({event:"UPDATED",substitute:expect.objectContaining({id:"new"})}));
    expect(mocks.notify).toHaveBeenNthCalledWith(2,expect.objectContaining({event:"REPLACED",substitute:expect.objectContaining({id:"sub"})}));
  });
  it("notifies the substitute when an active delegation is manually cancelled", async () => {
    mocks.currentUser.mockResolvedValue({ id:"avor",name:"Florian",roles:["AVOR"] });
    mocks.findDelegation.mockResolvedValue({ id:"d1",delegatingUserId:"avor",substituteUserId:"sub",scope:"AVOR_APPROVAL",startsAt:new Date("2026-09-01T00:00:00Z"),endsAt:new Date("2099-10-04T00:00:00Z"),enabled:true,delegatingUser:{id:"avor",name:"Florian"},substituteUser:{id:"sub",name:"Max",email:"max@falu.ch"} });
    await cancelDelegation("d1");
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({event:"CANCELLED",substitute:expect.objectContaining({id:"sub"})}));
  });
});
