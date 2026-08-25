import { z } from "zod";
import type { AuthUser, RoleKey } from "@/modules/auth";

export type ApprovalTypeKey = "AVOR" | "TECHNICAL";
export type ApprovalStatusKey = "PENDING" | "APPROVED" | "REJECTED";

export const APPROVAL_LABELS: Record<ApprovalStatusKey, string> = { PENDING: "Offen", APPROVED: "Freigegeben", REJECTED: "Abgelehnt" };

export function canDecideApproval(user: Pick<AuthUser, "roles">, type: ApprovalTypeKey) {
  const required: RoleKey = type === "AVOR" ? "AVOR" : "TECHNICAL";
  return user.roles.includes("ADMINISTRATOR") || user.roles.includes(required);
}

export function approvalActionAvailable({ canDecide, approvalStatus, requestStatus, approvalCycle, currentCycle }: { canDecide: boolean; approvalStatus: ApprovalStatusKey; requestStatus: string; approvalCycle: number; currentCycle: number }) {
  return canDecide && approvalStatus === "PENDING" && requestStatus === "UNDER_REVIEW" && approvalCycle === currentCycle;
}

export const approvalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().max(2_000, "Der Kommentar darf höchstens 2'000 Zeichen enthalten."),
}).superRefine((value, ctx) => {
  if (value.decision === "REJECTED" && !value.comment) ctx.addIssue({ code: "custom", path: ["comment"], message: "Bitte begründen Sie die Ablehnung." });
});

export function resultingRequestStatus(statuses: ApprovalStatusKey[]) {
  if (statuses.includes("REJECTED")) return "CHANGES_REQUESTED" as const;
  if (statuses.length === 2 && statuses.every((status) => status === "APPROVED")) return "APPROVED_FOR_IMPLEMENTATION" as const;
  return "UNDER_REVIEW" as const;
}

export function nextApprovalCycle(currentCycle: number) {
  return { cycle: currentCycle + 1, approvals: [
    { type: "AVOR" as const, status: "PENDING" as const, cycle: currentCycle + 1 },
    { type: "TECHNICAL" as const, status: "PENDING" as const, cycle: currentCycle + 1 },
  ] };
}

export function shouldTransition(currentStatus: string, nextStatus: string) {
  return currentStatus === "UNDER_REVIEW" && nextStatus !== "UNDER_REVIEW";
}

export function approvalAuditSummary(userName: string, type: ApprovalTypeKey, decision: "APPROVED" | "REJECTED") {
  const label = type === "AVOR" ? "AVOR-Freigabe" : "technische Freigabe";
  return `${userName} hat die ${label} ${decision === "APPROVED" ? "erteilt" : "abgelehnt"}.`;
}
