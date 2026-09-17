"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { approvalAuditSummary, approvalDecisionSchema, resultingRequestStatus, shouldTransition, type ApprovalTypeKey } from "./domain";
import { resolveApprovalAuthority } from "@/modules/delegations/authorization";
import { queueRequestNotification } from "@/modules/notifications/workflow";
import { sendNotifications } from "@/modules/notifications/service";

export type ApprovalActionState = { error?: string; success?: boolean };

export async function decideApproval(requestId: string, type: ApprovalTypeKey, _state: ApprovalActionState, formData: FormData): Promise<ApprovalActionState> {
  const user = await getCurrentUser();
  const authority = await resolveApprovalAuthority(user, type);
  if (!authority.allowed) return { error: "Sie besitzen keine Berechtigung für diese Freigabe." };
  const parsed = approvalDecisionSchema.safeParse({ decision: formData.get("decision"), comment: String(formData.get("comment") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    let notificationIds: string[] = [];
    await db.$transaction(async (tx) => {
      const request = await tx.changeRequest.findUniqueOrThrow({ where: { id: requestId }, select: { status: true, approvalCycle: true } });
      if (request.status !== "UNDER_REVIEW") throw new Error("Der Antrag befindet sich nicht mehr in Prüfung.");
      const approval = await tx.approval.findUniqueOrThrow({ where: { changeRequestId_type_cycle: { changeRequestId: requestId, type, cycle: request.approvalCycle } } });
      const changed = await tx.approval.updateMany({ where: { id: approval.id, status: "PENDING" }, data: { status: parsed.data.decision, comment: parsed.data.comment || null, decisionUserId: user.id, representedUserId: authority.delegation?.delegatingUserId ?? null, delegationId: authority.delegation?.id ?? null, decidedAt: new Date() } });
      if (changed.count !== 1) throw new Error("Für diese Freigabe wurde bereits eine Entscheidung gespeichert.");
      const delegatedSummary = authority.delegation ? `${user.name} hat die ${type === "AVOR" ? "AVOR-Freigabe" : "technische Freigabe"} als Stellvertreter von ${authority.delegation.delegatingUser.name} ${parsed.data.decision === "APPROVED" ? "erteilt" : "abgelehnt"}.` : approvalAuditSummary(user.name,type,parsed.data.decision);
      await tx.auditEvent.create({ data: { changeRequestId: requestId, userId: user.id, action: `${type}_${parsed.data.decision}`, entityType: "Approval", entityId: approval.id, summary: delegatedSummary, details: { cycle: request.approvalCycle, type, status: parsed.data.decision, comment: parsed.data.comment || null, delegationId: authority.delegation?.id ?? null, representedUserId: authority.delegation?.delegatingUserId ?? null, actualActorId: user.id } } });
      const current = await tx.approval.findMany({ where: { changeRequestId: requestId, cycle: request.approvalCycle }, select: { status: true } });
      const nextStatus = resultingRequestStatus(current.map((item) => item.status));
      if (shouldTransition(request.status,nextStatus)) {
        const transitioned = await tx.changeRequest.updateMany({ where: { id: requestId, status: "UNDER_REVIEW", approvalCycle: request.approvalCycle }, data: { status: nextStatus, version: { increment: 1 } } });
        if (transitioned.count === 1) {
          await tx.auditEvent.create({ data: { changeRequestId: requestId, userId: user.id, action: "STATUS_TRANSITIONED", entityType: "ChangeRequest", entityId: requestId, summary: nextStatus === "APPROVED_FOR_IMPLEMENTATION" ? "Der Änderungsantrag wurde automatisch zur Umsetzung freigegeben." : "Der Änderungsantrag wurde automatisch zur Überarbeitung zurückgegeben.", details: { from: "UNDER_REVIEW", to: nextStatus, cycle: request.approvalCycle } } });
          notificationIds = await queueRequestNotification(tx, requestId, nextStatus === "APPROVED_FOR_IMPLEMENTATION" ? "REQUEST_APPROVED" : "REQUEST_CHANGES_REQUIRED", `approval-result:${requestId}:${request.approvalCycle}`, nextStatus === "CHANGES_REQUESTED" ? `${type === "AVOR" ? "AVOR" : "Technik"}: ${parsed.data.comment}` : undefined);
        }
      }
    }, { isolationLevel: "Serializable" });
    await sendNotifications(notificationIds);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Die Freigabe konnte nicht gespeichert werden." };
  }
  revalidatePath("/"); revalidatePath("/change-requests"); revalidatePath(`/change-requests/${requestId}`);
  return { success: true };
}
