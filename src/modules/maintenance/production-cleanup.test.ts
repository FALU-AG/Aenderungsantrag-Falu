import { describe, expect, it, vi } from "vitest";
import { formatProductionCleanup, productionCleanup, PRODUCTION_CLEANUP_CONFIRMATION, PRODUCTION_DATA_CLASSIFICATION, ProductionCleanupStorageError, validateProductionCleanupExecution } from "./production-cleanup";

const childModels = ["changeRequestMachineType", "changeRequestReason", "approval", "finalApproval", "technicalReview", "avorImpactReview", "purchasingReview", "task", "attachment", "comment", "auditEvent", "emailNotification"] as const;

function fixture(options: { unsafeStorage?: boolean; concurrentChange?: boolean; storageFailure?: boolean } = {}) {
  const attachment = { id:"att-1",changeRequestId:"cr-1",storageProvider:"SUPABASE" as const,storageKey:options.unsafeStorage?"other/path.pdf":"change-requests/cr-1/att-1/test.pdf" };
  const request = { id:"cr-1",number:"CR-2026-007",updatedAt:new Date("2026-09-20T10:00:00Z"),tasks:[{id:"task-1"}],attachments:[attachment] };
  const deletionOrder:string[]=[];
  const tx = Object.fromEntries(childModels.map((name)=>[name,{deleteMany:vi.fn(async()=>{deletionOrder.push(name);return{count:1};})}])) as Record<string,{deleteMany:ReturnType<typeof vi.fn>}> & {
    changeRequestCounter: { upsert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    changeRequest: { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  };
  Object.assign(tx,{
    changeRequestCounter:{upsert:vi.fn(),update:vi.fn()},
    changeRequest:{findMany:vi.fn(async()=>options.concurrentChange?[{...request,updatedAt:new Date("2026-09-20T11:00:00Z")}]:[request]),deleteMany:vi.fn(async()=>{deletionOrder.push("changeRequest");return{count:1};}),count:vi.fn(async()=>0)},
  });
  let counterRead=0;
  const counted = Object.fromEntries(childModels.map((name)=>[name,{count:vi.fn(async()=>name==="emailNotification"?3:1)}])) as Record<string,{count:ReturnType<typeof vi.fn>}>;
  const db = {
    ...counted,
    changeRequest:{findMany:vi.fn(async()=>[request]),count:vi.fn(async(args?:unknown)=>args?1:0)},
    user:{findMany:vi.fn(async()=>[{id:"u1",name:"Florian",email:"florian@falu.ch",active:true,externalId:"entra-1"},{id:"u2",name:"Anna",email:"anna@falu.ch",active:true,externalId:null}]),count:vi.fn(async()=>2)},
    role:{count:vi.fn(async()=>4)},userRole:{count:vi.fn(async()=>4)},session:{count:vi.fn(async()=>2)},passwordResetToken:{count:vi.fn(async()=>1)},approvalDelegation:{count:vi.fn(async()=>1)},machineType:{count:vi.fn(async()=>12)},changeReason:{count:vi.fn(async()=>5)},appSetting:{count:vi.fn(async()=>3)},
    changeRequestCounter:{findUnique:vi.fn(async()=>counterRead++===0?{nextNumber:8}:{nextNumber:1}),count:vi.fn(async()=>1)},
    $transaction:vi.fn(async(callback:(client:typeof tx)=>Promise<void>)=>callback(tx)),
  };
  const remove=vi.fn(async()=>{if(options.storageFailure)throw new Error("unavailable");});
  return {db,tx,remove,attachment,deletionOrder};
}

describe("production cleanup",()=>{
  it("classifies transactional, master, auth and ambiguous data explicitly",()=>{
    expect(PRODUCTION_DATA_CLASSIFICATION.transactional).toContain("ChangeRequest");
    expect(PRODUCTION_DATA_CLASSIFICATION.master).toEqual(expect.arrayContaining(["MachineType","ChangeReason","AppSetting"]));
    expect(PRODUCTION_DATA_CLASSIFICATION.userAndAuth).toEqual(expect.arrayContaining(["User","Role","ApprovalDelegation"]));
    expect(PRODUCTION_DATA_CLASSIFICATION.ambiguous).toContain("unreferenced Storage objects");
  });
  it("requires both execute mode and the exact production confirmation",()=>{
    expect(()=>validateProductionCleanupExecution(false)).not.toThrow();
    expect(()=>validateProductionCleanupExecution(true)).toThrow("Execution refused");
    expect(()=>validateProductionCleanupExecution(true,"wrong")).toThrow("Execution refused");
    expect(()=>validateProductionCleanupExecution(true,PRODUCTION_CLEANUP_CONFIRMATION)).not.toThrow();
  });
  it("defaults to a comprehensive dry run without database or Storage mutation",async()=>{
    const {db,remove}=fixture();const result=await productionCleanup(db as never,{now:new Date("2026-09-21T00:00:00Z")},remove);
    expect(result.executed).toBe(false);expect(result.counts).toMatchObject({changeRequests:1,approvals:1,tasks:1,attachments:1,notifications:3,completionSummaries:1});
    expect(result.preserved).toMatchObject({users:2,roles:4,machineTypes:12,delegations:1});expect(result.numbering).toEqual({year:2026,currentNextNumber:8,proposedNextNumber:1,proposedFirstNumber:"CR-2026-001"});
    expect(remove).not.toHaveBeenCalled();expect(db.$transaction).not.toHaveBeenCalled();expect(formatProductionCleanup(result)).toContain("NO DATA CHANGED");
  });
  it("rejects unsafe request-owned Storage paths before mutation",async()=>{const {db,remove}=fixture({unsafeStorage:true});await expect(productionCleanup(db as never,{},remove)).rejects.toThrow("Unsafe Supabase Storage key");expect(remove).not.toHaveBeenCalled();expect(db.$transaction).not.toHaveBeenCalled();});
  it("aborts database cleanup and reports Storage failures explicitly",async()=>{const {db,remove}=fixture({storageFailure:true});const error=await productionCleanup(db as never,{execute:true,confirmation:PRODUCTION_CLEANUP_CONFIRMATION},remove).catch((value)=>value);expect(error).toBeInstanceOf(ProductionCleanupStorageError);expect(error.failures).toEqual([{provider:"SUPABASE",key:"change-requests/cr-1/att-1/test.pdf"}]);expect(db.$transaction).not.toHaveBeenCalled();});
  it("deletes only request-owned transactional rows, preserves users/master data and resets the current counter",async()=>{
    const {db,tx,remove,deletionOrder}=fixture();const result=await productionCleanup(db as never,{execute:true,confirmation:PRODUCTION_CLEANUP_CONFIRMATION,now:new Date("2026-09-21T00:00:00Z")},remove);
    expect(result.executed).toBe(true);expect(remove).toHaveBeenCalledWith("SUPABASE","change-requests/cr-1/att-1/test.pdf");expect(deletionOrder.at(-1)).toBe("changeRequest");expect(tx.emailNotification.deleteMany).toHaveBeenCalled();expect(tx.changeRequestCounter.update).toHaveBeenCalledWith({where:{year:2026},data:{nextNumber:1}});
    expect(db.user.findMany).toHaveBeenCalled();expect(db.user.count).toHaveBeenCalled();expect((db.user as {deleteMany?:unknown}).deleteMany).toBeUndefined();expect((db.machineType as {deleteMany?:unknown}).deleteMany).toBeUndefined();
  });
  it("refuses a changed request snapshot before database deletion or numbering reset",async()=>{const {db,tx,remove}=fixture({concurrentChange:true});await expect(productionCleanup(db as never,{execute:true,confirmation:PRODUCTION_CLEANUP_CONFIRMATION},remove)).rejects.toThrow("data changed");expect(tx.changeRequest.deleteMany).not.toHaveBeenCalled();expect(tx.changeRequestCounter.update).not.toHaveBeenCalled();});
});
