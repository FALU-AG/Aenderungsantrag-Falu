"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth";
import { db } from "@/server/db/client";
import {
  canClose,
  canFinalApprove,
  canReopenClosed,
  canRequestFinalChanges,
  finalApprovalSchema,
  finalAudit,
  finalCommentSchema,
  nextFinalReviewCycle,
  reasonSchema,
  type FinalApprovalType,
} from "./domain";
import { queueRequestNotification } from "@/modules/notifications/workflow";
import { sendNotifications } from "@/modules/notifications/service";
export type FinalReviewActionState = { message?: string; success?: string };
const refresh = (id: string) => {
  revalidatePath("/");
  revalidatePath("/change-requests");
  revalidatePath(`/change-requests/${id}`);
};
async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt++)
    try {
      return await db.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt === 2
      )
        throw error;
    }
  throw new Error("Transaktion fehlgeschlagen.");
}
async function closureState(tx: Prisma.TransactionClient, id: string) {
  const request = await tx.changeRequest.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      finalReviewCycle: true,
      technicalReview: { select: { completed: true } },
      avorImpactReview: { select: { completed: true } },
      purchasingReview: { select: { completed: true } },
      tasks: {
        where: { requiredForClosure: true, status: { not: "DONE" } },
        select: { id: true },
      },
    },
  });
  return {
    request,
    state: {
      technicalCompleted: Boolean(request.technicalReview?.completed),
      avorCompleted: Boolean(request.avorImpactReview?.completed),
      purchasingCompleted: Boolean(request.purchasingReview?.completed),
      blockingTasks: request.tasks.length,
    },
  };
}
export async function saveFinalComment(
  requestId: string,
  _state: FinalReviewActionState,
  form: FormData,
): Promise<FinalReviewActionState> {
  const user = await getCurrentUser();
  if (!canRequestFinalChanges(user))
    return { message: "Sie dürfen die Abschlussbemerkung nicht bearbeiten." };
  const parsed = finalCommentSchema.safeParse({
    finalComment: form.get("finalComment"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const changed = await db.changeRequest.updateMany({
    where: { id: requestId, status: "FINAL_REVIEW" },
    data: {
      finalComment: parsed.data.finalComment || null,
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1)
    return {
      message:
        "Die Abschlussbemerkung ist nur während der Abschlussprüfung bearbeitbar.",
    };
  const audit = finalAudit("COMMENT_UPDATED", user.name);
  await db.auditEvent.create({
    data: {
      changeRequestId: requestId,
      userId: user.id,
      ...audit,
      entityType: "ChangeRequest",
      entityId: requestId,
    },
  });
  refresh(requestId);
  return { success: "Abschlussbemerkung gespeichert." };
}
export async function grantFinalApproval(
  requestId: string,
  type: FinalApprovalType,
  _state: FinalReviewActionState,
  form: FormData,
): Promise<FinalReviewActionState> {
  const user = await getCurrentUser();
  if (!canFinalApprove(user, type))
    return { message: "Sie dürfen diese Abschlussfreigabe nicht erteilen." };
  const parsed = finalApprovalSchema.safeParse({
    comment: form.get("comment"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  try {
    let notificationIds: string[] = [];
    const closed = await serializable(async (tx) => {
      const { request, state } = await closureState(tx, requestId);
      if (request.status !== "FINAL_REVIEW")
        throw new Error(
          "Der Antrag befindet sich nicht in der Abschlussprüfung.",
        );
      if (!Object.values(state).every((value) => value === true || value === 0))
        throw new Error(
          "Die Voraussetzungen für die Abschlussfreigabe sind noch nicht erfüllt.",
        );
      const approval = await tx.finalApproval.create({
        data: {
          changeRequestId: requestId,
          cycle: request.finalReviewCycle,
          type,
          approvedById: user.id,
          comment: parsed.data.comment || null,
        },
      });
      const audit = finalAudit("APPROVED", user.name, type);
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          ...audit,
          entityType: "FinalApproval",
          entityId: approval.id,
          details: { cycle: request.finalReviewCycle, type },
        },
      });
      const types = (
        await tx.finalApproval.findMany({
          where: {
            changeRequestId: requestId,
            cycle: request.finalReviewCycle,
          },
          select: { type: true },
        })
      ).map((item) => item.type as FinalApprovalType);
      if (!canClose(state, types)) return false;
      const changed = await tx.changeRequest.updateMany({
        where: {
          id: requestId,
          status: "FINAL_REVIEW",
          finalReviewCycle: request.finalReviewCycle,
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedById: user.id,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) return false;
      const closeAudit = finalAudit("CLOSED", user.name);
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          ...closeAudit,
          entityType: "ChangeRequest",
          entityId: requestId,
          details: { cycle: request.finalReviewCycle, triggeredBy: user.id },
        },
      });
      notificationIds = await queueRequestNotification(tx, requestId, "REQUEST_CLOSED", `closed:${requestId}:${request.finalReviewCycle}`);
      return true;
    });
    await sendNotifications(notificationIds);
    refresh(requestId);
    return {
      success: closed
        ? "Der Änderungsantrag wurde abgeschlossen."
        : "Abschlussfreigabe gespeichert.",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { message: "Diese Abschlussfreigabe wurde bereits erteilt." };
    return {
      message:
        error instanceof Error
          ? error.message
          : "Abschlussfreigabe fehlgeschlagen.",
    };
  }
}
export async function requestFinalChanges(
  requestId: string,
  _state: FinalReviewActionState,
  form: FormData,
): Promise<FinalReviewActionState> {
  const user = await getCurrentUser();
  if (!canRequestFinalChanges(user))
    return { message: "Sie dürfen keine Änderungen anfordern." };
  const parsed = reasonSchema.safeParse({ reason: form.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  await serializable(async (tx) => {
    const request = await tx.changeRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, finalReviewCycle: true },
    });
    if (request.status !== "FINAL_REVIEW")
      throw new Error(
        "Änderungen können nur in der Abschlussprüfung angefordert werden.",
      );
    const next = nextFinalReviewCycle(request.finalReviewCycle);
    await tx.changeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED_FOR_IMPLEMENTATION",
        finalReviewCycle: next,
        version: { increment: 1 },
      },
    });
    const audit = finalAudit(
      "CHANGES_REQUIRED",
      user.name,
      undefined,
      parsed.data.reason,
    );
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId: user.id,
        ...audit,
        entityType: "ChangeRequest",
        entityId: requestId,
        details: {
          reason: parsed.data.reason,
          previousCycle: request.finalReviewCycle,
          nextCycle: next,
        },
      },
    });
  });
  refresh(requestId);
  return { success: "Änderungen wurden angefordert." };
}
export async function reopenClosedRequest(
  requestId: string,
  _state: FinalReviewActionState,
  form: FormData,
): Promise<FinalReviewActionState> {
  const user = await getCurrentUser();
  if (!canReopenClosed(user))
    return {
      message:
        "Nur die Administration darf abgeschlossene Anträge erneut öffnen.",
    };
  const parsed = reasonSchema.safeParse({ reason: form.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  await serializable(async (tx) => {
    const request = await tx.changeRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: {
        status: true,
        closedAt: true,
        closedById: true,
        finalReviewCycle: true,
      },
    });
    if (request.status !== "CLOSED")
      throw new Error("Der Antrag ist nicht abgeschlossen.");
    const next = nextFinalReviewCycle(request.finalReviewCycle);
    await tx.changeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED_FOR_IMPLEMENTATION",
        closedAt: null,
        closedById: null,
        finalReviewCycle: next,
        version: { increment: 1 },
      },
    });
    const audit = finalAudit(
      "REOPENED",
      user.name,
      undefined,
      parsed.data.reason,
    );
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId: user.id,
        ...audit,
        entityType: "ChangeRequest",
        entityId: requestId,
        details: {
          reason: parsed.data.reason,
          previousClosedAt: request.closedAt?.toISOString(),
          previousClosedById: request.closedById,
          previousCycle: request.finalReviewCycle,
          nextCycle: next,
        },
      },
    });
  });
  refresh(requestId);
  return { success: "Der Änderungsantrag wurde erneut geöffnet." };
}
