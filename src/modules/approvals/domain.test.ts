import { describe, expect, it } from "vitest";
import { approvalAuditSummary, approvalDecisionSchema, canDecideApproval, nextApprovalCycle, resultingRequestStatus, shouldTransition } from "./domain";
const user=(roles:("EMPLOYEE"|"AVOR"|"TECHNICAL"|"ADMINISTRATOR")[])=>({roles});
describe("Freigabeworkflow",()=>{
  it("verweigert Mitarbeitenden Freigaben",()=>expect(canDecideApproval(user(["EMPLOYEE"]),"AVOR")).toBe(false));
  it("trennt AVOR- und Technikberechtigung",()=>{expect(canDecideApproval(user(["AVOR"]),"AVOR")).toBe(true);expect(canDecideApproval(user(["AVOR"]),"TECHNICAL")).toBe(false);expect(canDecideApproval(user(["TECHNICAL"]),"TECHNICAL")).toBe(true)});
  it("erlaubt Administratoren beide Freigaben",()=>expect(canDecideApproval(user(["ADMINISTRATOR"]),"TECHNICAL")).toBe(true));
  it("verlangt nur bei Ablehnung einen Kommentar",()=>{expect(approvalDecisionSchema.safeParse({decision:"APPROVED",comment:""}).success).toBe(true);const rejected=approvalDecisionSchema.safeParse({decision:"REJECTED",comment:""});expect(rejected.success).toBe(false);if(!rejected.success)expect(rejected.error.issues[0].message).toBe("Bitte begründen Sie die Ablehnung.")});
  it("bleibt nach einer Freigabe in Prüfung",()=>expect(resultingRequestStatus(["APPROVED","PENDING"])).toBe("UNDER_REVIEW"));
  it("gibt nach zwei Freigaben zur Umsetzung frei",()=>expect(resultingRequestStatus(["APPROVED","APPROVED"])).toBe("APPROVED_FOR_IMPLEMENTATION"));
  it("fordert bei jeder Ablehnung eine Änderung",()=>expect(resultingRequestStatus(["APPROVED","REJECTED"])).toBe("CHANGES_REQUESTED"));
  it("erzeugt eine neue Runde mit zwei offenen, ohne alte Daten zu verändern",()=>{const previous=[{type:"AVOR",status:"APPROVED",cycle:1}] as const;const next=nextApprovalCycle(1);expect(next.cycle).toBe(2);expect(next.approvals).toHaveLength(2);expect(next.approvals.every(a=>a.status==="PENDING")).toBe(true);expect(previous[0].status).toBe("APPROVED")});
  it("führt einen automatischen Übergang nur aus In Prüfung aus",()=>{expect(shouldTransition("UNDER_REVIEW","APPROVED_FOR_IMPLEMENTATION")).toBe(true);expect(shouldTransition("APPROVED_FOR_IMPLEMENTATION","APPROVED_FOR_IMPLEMENTATION")).toBe(false)});
  it("erzeugt deutsche Freigabe-Audittexte",()=>expect(approvalAuditSummary("Anna AVOR","AVOR","APPROVED")).toBe("Anna AVOR hat die AVOR-Freigabe erteilt."));
});
