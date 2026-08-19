"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  canEditPurchasingReview,
  purchasingAudit,
  purchasingCompletionMetadata,
  purchasingCompletionSchema,
  purchasingDraftSchema,
  purchasingReopenedMetadata,
  reopenPurchasingSchema,
} from "./domain";

export type PurchasingActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: string;
};
const bool = (v: FormDataEntryValue | null) =>
  v === "YES" ? true : v === "NO" ? false : null;
function input(form: FormData) {
  return {
    purchasingRequired: bool(form.get("purchasingRequired")),
    supplier: String(form.get("supplier") ?? ""),
    supplierNotes: String(form.get("supplierNotes") ?? ""),
    orderRequired: bool(form.get("orderRequired")),
    orderCompleted: form.get("orderCompleted") === "YES",
    orderNumber: String(form.get("orderNumber") ?? ""),
    orderDate: String(form.get("orderDate") ?? ""),
    expectedDeliveryDate: String(form.get("expectedDeliveryDate") ?? ""),
    notes: String(form.get("notes") ?? ""),
  };
}
const refresh = (id: string) => {
  revalidatePath("/");
  revalidatePath("/change-requests");
  revalidatePath(`/change-requests/${id}`);
};
export async function savePurchasingReview(
  requestId: string,
  _state: PurchasingActionState,
  form: FormData,
): Promise<PurchasingActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "PURCHASING_EDIT");
  const intent = String(form.get("intent"));
  const parsed = (
    intent === "complete" ? purchasingCompletionSchema : purchasingDraftSchema
  ).safeParse(input(form));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true, purchasingReview: { select: { completed: true } } },
  });
  if (!canEditPurchasingReview(user, request.status))
    return {
      message: "Die Einkaufsprüfung ist in diesem Status nicht bearbeitbar.",
    };
  if (request.purchasingReview?.completed)
    return {
      message:
        "Eine abgeschlossene Einkaufsprüfung muss zuerst erneut geöffnet werden.",
    };
  await db.$transaction(
    async (tx) => {
      const current = await tx.changeRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { status: true, finalReviewCycle: true },
      });
      const existing = await tx.purchasingReview.findUnique({
        where: { changeRequestId: requestId },
      });
      if (existing?.completed)
        throw new Error(
          "Eine abgeschlossene Einkaufsprüfung muss zuerst erneut geöffnet werden.",
        );
      const orderJustPlaced =
        parsed.data.orderCompleted && !existing?.orderCompleted;
      const data = {
        ...parsed.data,
        supplier: parsed.data.supplier || null,
        supplierNotes: parsed.data.supplierNotes || null,
        orderNumber: parsed.data.orderNumber || null,
        notes: parsed.data.notes || null,
        ...(!parsed.data.purchasingRequired
          ? {
              supplier: null,
              supplierNotes: null,
              orderRequired: false,
              orderCompleted: false,
              orderNumber: null,
              orderDate: null,
              orderedById: null,
              expectedDeliveryDate: null,
            }
          : {}),
        ...(orderJustPlaced
          ? {
              orderDate: parsed.data.orderDate ?? new Date(),
              orderedById: user.id,
            }
          : {}),
        ...(intent === "complete" ? purchasingCompletionMetadata(user.id) : {}),
      };
      const review = await tx.purchasingReview.upsert({
        where: { changeRequestId: requestId },
        create: { changeRequestId: requestId, ...data },
        update: data,
      });
      const audit = purchasingAudit(
        user.name,
        intent === "complete" ? "COMPLETED" : existing ? "SAVED" : "STARTED",
      );
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          ...audit,
          entityType: "PurchasingReview",
          entityId: review.id,
        },
      });
      if (orderJustPlaced) {
        const orderAudit = purchasingAudit(user.name, "ORDER_PLACED");
        await tx.auditEvent.create({
          data: {
            changeRequestId: requestId,
            userId: user.id,
            ...orderAudit,
            entityType: "PurchasingReview",
            entityId: review.id,
            details: { orderNumber: parsed.data.orderNumber || null },
          },
        });
      }
      if (
        intent === "complete" &&
        current.status === "PURCHASING_PROCUREMENT"
      ) {
        const changed = await tx.changeRequest.updateMany({
          where: { id: requestId, status: "PURCHASING_PROCUREMENT" },
          data: { status: "FINAL_REVIEW", version: { increment: 1 } },
        });
        if (changed.count === 1) {
          await tx.auditEvent.create({
            data: {
              changeRequestId: requestId,
              userId: user.id,
              action: "STATUS_TRANSITIONED",
              entityType: "ChangeRequest",
              entityId: requestId,
              summary:
                "Der Änderungsantrag wurde in die Abschlussprüfung überführt.",
              details: { from: "PURCHASING_PROCUREMENT", to: "FINAL_REVIEW" },
            },
          });
          await tx.auditEvent.create({
            data: {
              changeRequestId: requestId,
              userId: user.id,
              action: "FINAL_REVIEW_CYCLE_STARTED",
              entityType: "ChangeRequest",
              entityId: requestId,
              summary: `Abschlussprüfung Zyklus ${current.finalReviewCycle} wurde gestartet.`,
              details: { cycle: current.finalReviewCycle },
            },
          });
        }
      }
    },
    { isolationLevel: "Serializable" },
  );
  refresh(requestId);
  return {
    success:
      intent === "complete"
        ? "Einkaufsprüfung abgeschlossen."
        : "Einkaufsprüfung gespeichert.",
  };
}
export async function reopenPurchasingReview(
  requestId: string,
  _state: PurchasingActionState,
  form: FormData,
): Promise<PurchasingActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "PURCHASING_EDIT");
  const parsed = reopenPurchasingSchema.safeParse({
    reason: form.get("reason"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true },
  });
  if (!canEditPurchasingReview(user, request.status))
    return {
      message: "Die Einkaufsprüfung ist in diesem Status nicht bearbeitbar.",
    };
  await db.$transaction(async (tx) => {
    const review = await tx.purchasingReview.findUniqueOrThrow({
      where: { changeRequestId: requestId },
    });
    const changed = await tx.purchasingReview.updateMany({
      where: { id: review.id, completed: true },
      data: purchasingReopenedMetadata(),
    });
    if (changed.count !== 1)
      throw new Error("Die Einkaufsprüfung ist bereits geöffnet.");
    const audit = purchasingAudit(user.name, "REOPENED", parsed.data.reason);
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId: user.id,
        ...audit,
        entityType: "PurchasingReview",
        entityId: review.id,
        details: {
          reason: parsed.data.reason,
          previousCompletedById: review.completedById,
          previousCompletedAt: review.completedAt?.toISOString(),
        },
      },
    });
  });
  refresh(requestId);
  return { success: "Einkaufsprüfung erneut geöffnet." };
}
