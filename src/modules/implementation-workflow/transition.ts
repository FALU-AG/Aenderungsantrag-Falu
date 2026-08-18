import type { ChangeRequestStatus, Prisma } from "@prisma/client";
import {
  shouldWriteStatusTransition,
  statusWhenImplementationReviewsComplete,
  statusWhenImplementationReviewStarts,
} from "./domain";
export async function applyImplementationReviewTransition(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string;
    currentStatus: ChangeRequestStatus;
    technicalCompleted: boolean;
    avorCompleted: boolean;
    userId: string;
  },
) {
  const started = statusWhenImplementationReviewStarts(input.currentStatus);
  const next = statusWhenImplementationReviewsComplete(
    started,
    input.technicalCompleted,
    input.avorCompleted,
  );
  if (!shouldWriteStatusTransition(input.currentStatus, next)) return next;
  const changed = await tx.changeRequest.updateMany({
    where: { id: input.requestId, status: input.currentStatus },
    data: { status: next, version: { increment: 1 } },
  });
  if (changed.count === 1)
    await tx.auditEvent.create({
      data: {
        changeRequestId: input.requestId,
        userId: input.userId,
        action: "STATUS_TRANSITIONED",
        entityType: "ChangeRequest",
        entityId: input.requestId,
        summary:
          next === "PURCHASING_PROCUREMENT"
            ? "Der Änderungsantrag wurde in die Phase Einkauf / Beschaffung überführt."
            : "Der Änderungsantrag wurde in die Phase AVOR / Produktionsvorbereitung überführt.",
        details: { from: input.currentStatus, to: next },
      },
    });
  return next;
}
