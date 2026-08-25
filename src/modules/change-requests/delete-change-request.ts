import type { AuthUser } from "@/modules/auth";
import { db } from "@/server/db/client";
import { removeStoredAttachment } from "@/server/storage/attachment-storage";
import { requireChangeRequestDeletion } from "./authorization";

type DeleteDatabase = typeof db;
type StorageRemoval = typeof removeStoredAttachment;

function validateAttachmentKey(attachment: { id: string; changeRequestId: string; storageProvider: "LOCAL" | "SUPABASE"; storageKey: string }) {
  if (attachment.storageProvider === "SUPABASE" && !attachment.storageKey.startsWith(`change-requests/${attachment.changeRequestId}/${attachment.id}/`))
    throw new Error("Der Antrag enthält einen ungültigen Anhangspfad und wurde nicht gelöscht.");
}

export async function permanentlyDeleteChangeRequest(client: DeleteDatabase, actor: AuthUser, requestId: string, removeStorage: StorageRemoval = removeStoredAttachment) {
  const request = await client.changeRequest.findUnique({
    where: { id: requestId },
    select: { id: true, number: true, approvals: { select: { type: true, status: true, cycle: true } }, tasks: { select: { id: true } }, attachments: { select: { id: true, changeRequestId: true, storageProvider: true, storageKey: true } } },
  });
  if (!request) throw new Error("Der Änderungsantrag wurde nicht gefunden.");
  requireChangeRequestDeletion(actor, request.approvals);
  for (const attachment of request.attachments) validateAttachmentKey(attachment);

  // Storage cannot join the PostgreSQL transaction. Exact preflight-validated objects are removed first.
  // A Storage failure stops before DB mutation; a later DB failure leaves metadata for a guarded retry.
  for (const attachment of request.attachments) await removeStorage(attachment.storageProvider, attachment.storageKey);

  await client.$transaction(async (tx) => {
    const current = await tx.changeRequest.findUnique({ where: { id: requestId }, select: { number: true, approvals: { select: { type: true, status: true, cycle: true } }, attachments: { select: { id: true } }, tasks: { select: { id: true } } } });
    if (!current || current.number !== request.number) throw new Error("Der Änderungsantrag wurde zwischenzeitlich verändert.");
    requireChangeRequestDeletion(actor, current.approvals);
    const expectedAttachments = request.attachments.map(({ id }) => id).sort().join("|");
    const currentAttachments = current.attachments.map(({ id }) => id).sort().join("|");
    if (expectedAttachments !== currentAttachments) throw new Error("Die Anhänge wurden zwischenzeitlich verändert. Bitte versuchen Sie es erneut.");
    const taskIds = current.tasks.map(({ id }) => id);
    await tx.emailNotification.deleteMany({ where: { OR: [{ changeRequestId: requestId }, ...(taskIds.length ? [{ taskId: { in: taskIds } }] : [])] } });
    await tx.changeRequestMachineType.deleteMany({ where: { changeRequestId: requestId } });
    await tx.changeRequestReason.deleteMany({ where: { changeRequestId: requestId } });
    await tx.approval.deleteMany({ where: { changeRequestId: requestId } });
    await tx.finalApproval.deleteMany({ where: { changeRequestId: requestId } });
    await tx.technicalReview.deleteMany({ where: { changeRequestId: requestId } });
    await tx.avorImpactReview.deleteMany({ where: { changeRequestId: requestId } });
    await tx.purchasingReview.deleteMany({ where: { changeRequestId: requestId } });
    await tx.task.deleteMany({ where: { changeRequestId: requestId } });
    await tx.attachment.deleteMany({ where: { changeRequestId: requestId } });
    await tx.comment.deleteMany({ where: { changeRequestId: requestId } });
    await tx.auditEvent.deleteMany({ where: { changeRequestId: requestId } });
    await tx.auditEvent.create({ data: { userId: actor.id, changeRequestId: null, action: "CHANGE_REQUEST_DELETED", entityType: "ChangeRequest", entityId: requestId, summary: `${actor.name} hat den Änderungsantrag ${request.number} endgültig gelöscht.`, details: { deletedRequestNumber: request.number, deletedAt: new Date().toISOString() } } });
    const deleted = await tx.changeRequest.deleteMany({ where: { id: requestId, number: request.number, approvals: { none: { status: "APPROVED" } } } });
    if (deleted.count !== 1) throw new Error("Dieser Änderungsantrag kann nicht mehr gelöscht werden, da bereits eine Freigabe erfolgt ist.");
  }, { isolationLevel: "Serializable" });
  return { number: request.number };
}
