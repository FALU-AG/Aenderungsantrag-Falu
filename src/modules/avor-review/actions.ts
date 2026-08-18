"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  avorAudit,
  avorCompletionMetadata,
  avorReopenedMetadata,
  avorReviewCompletionSchema,
  avorReviewDraftSchema,
  canEditAvorReview,
  reopenAvorSchema,
  type ImpactAnswerKey,
} from "./domain";
import { applyImplementationReviewTransition } from "@/modules/implementation-workflow/transition";
export type AvorActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: string;
};
const answer = (v: FormDataEntryValue | null): ImpactAnswerKey | null =>
  v === "YES" || v === "NO" || v === "NOT_RELEVANT" ? v : null;
function input(f: FormData) {
  return {
    stockNeedsAction: answer(f.get("stockNeedsAction")),
    stockActionExplanation: String(f.get("stockActionExplanation") ?? ""),
    purchaseOrdersNeedUpdate: answer(f.get("purchaseOrdersNeedUpdate")),
    purchaseOrderExplanation: String(f.get("purchaseOrderExplanation") ?? ""),
    productionOrdersNeedUpdate: answer(f.get("productionOrdersNeedUpdate")),
    productionOrderExplanation: String(
      f.get("productionOrderExplanation") ?? "",
    ),
    deliveredMachinesNeedParts: answer(f.get("deliveredMachinesNeedParts")),
    deliveredMachinesExplanation: String(
      f.get("deliveredMachinesExplanation") ?? "",
    ),
    validFromMachineNumber: String(f.get("validFromMachineNumber") ?? ""),
    estimatedAdditionalCosts: String(f.get("estimatedAdditionalCosts") ?? ""),
    remarks: String(f.get("remarks") ?? ""),
  };
}
export async function saveAvorReview(
  requestId: string,
  _state: AvorActionState,
  form: FormData,
): Promise<AvorActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "AVOR_REVIEW_EDIT");
  const intent = String(form.get("intent"));
  const parsed = (
    intent === "complete" ? avorReviewCompletionSchema : avorReviewDraftSchema
  ).safeParse(input(form));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true, avorImpactReview: { select: { completed: true } } },
  });
  if (!canEditAvorReview(user, request.status))
    return {
      message: "Die AVOR-Prüfung ist in diesem Status nicht bearbeitbar.",
    };
  if (request.avorImpactReview?.completed)
    return {
      message:
        "Eine abgeschlossene AVOR-Prüfung muss zuerst erneut geöffnet werden.",
    };
  await db.$transaction(
    async (tx) => {
      const current = await tx.changeRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: {
          status: true,
          technicalReview: { select: { completed: true } },
        },
      });
      const existing = await tx.avorImpactReview.findUnique({
        where: { changeRequestId: requestId },
        select: { id: true, completed: true },
      });
      if (existing?.completed)
        throw new Error(
          "Eine abgeschlossene AVOR-Prüfung muss zuerst erneut geöffnet werden.",
        );
      const data = {
        ...parsed.data,
        stockActionExplanation: parsed.data.stockActionExplanation || null,
        purchaseOrderExplanation: parsed.data.purchaseOrderExplanation || null,
        productionOrderExplanation:
          parsed.data.productionOrderExplanation || null,
        deliveredMachinesExplanation:
          parsed.data.deliveredMachinesExplanation || null,
        validFromMachineNumber: parsed.data.validFromMachineNumber || null,
        estimatedAdditionalCosts: parsed.data.estimatedAdditionalCosts,
        remarks: parsed.data.remarks || null,
        ...(intent === "complete" ? avorCompletionMetadata(user.id) : {}),
      };
      const review = await tx.avorImpactReview.upsert({
        where: { changeRequestId: requestId },
        create: { changeRequestId: requestId, ...data },
        update: data,
      });
      const audit = avorAudit(
        user.name,
        intent === "complete" ? "COMPLETED" : existing ? "SAVED" : "STARTED",
      );
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          ...audit,
          entityType: "AvorImpactReview",
          entityId: review.id,
        },
      });
      await applyImplementationReviewTransition(tx, {
        requestId,
        currentStatus: current.status,
        technicalCompleted: Boolean(current.technicalReview?.completed),
        avorCompleted: intent === "complete",
        userId: user.id,
      });
    },
    { isolationLevel: "Serializable" },
  );
  revalidatePath("/");
  revalidatePath("/change-requests");
  revalidatePath(`/change-requests/${requestId}`);
  return {
    success:
      intent === "complete"
        ? "AVOR-Prüfung abgeschlossen."
        : "AVOR-Prüfung gespeichert.",
  };
}
export async function reopenAvorReview(
  requestId: string,
  _state: AvorActionState,
  form: FormData,
): Promise<AvorActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "AVOR_REVIEW_EDIT");
  const parsed = reopenAvorSchema.safeParse({ reason: form.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true },
  });
  if (!canEditAvorReview(user, request.status))
    return {
      message: "Die AVOR-Prüfung ist in diesem Status nicht bearbeitbar.",
    };
  await db.$transaction(async (tx) => {
    const review = await tx.avorImpactReview.findUniqueOrThrow({
      where: { changeRequestId: requestId },
    });
    const changed = await tx.avorImpactReview.updateMany({
      where: { id: review.id, completed: true },
      data: avorReopenedMetadata(),
    });
    if (changed.count !== 1)
      throw new Error("Die AVOR-Prüfung ist bereits geöffnet.");
    const audit = avorAudit(user.name, "REOPENED", parsed.data.reason);
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId: user.id,
        ...audit,
        entityType: "AvorImpactReview",
        entityId: review.id,
        details: {
          reason: parsed.data.reason,
          previousCompletedById: review.completedById,
          previousCompletedAt: review.completedAt?.toISOString(),
        },
      },
    });
  });
  revalidatePath(`/change-requests/${requestId}`);
  return { success: "AVOR-Prüfung erneut geöffnet." };
}
