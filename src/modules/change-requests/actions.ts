"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  creatorAndApplicant,
  editableApplicant,
  formDataToInput,
  draftSchema,
  submissionSchema,
} from "./validation";
import { generateChangeRequestNumber } from "./numbering";
import { requireDraftEdit } from "./authorization";
import { cleanupUploadedAttachment, removeStoredAttachment, supabaseObjectKey, uploadNewAttachment } from "@/server/storage/attachment-storage";
import { submissionData } from "./submission";

export type FormState = { errors?: Record<string, string[]>; message?: string };
const errorsOf = (error: {
  flatten(): { fieldErrors: Record<string, string[]> };
}): FormState => ({ errors: error.flatten().fieldErrors });

export async function saveChangeRequest(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  requirePermission(user, "CHANGE_REQUEST_CREATE");
  const intent = String(formData.get("intent"));
  const input = formDataToInput(formData);
  const id = String(formData.get("id") ?? "");
  const other = await db.changeReason.findFirst({
    where: { isOther: true, active: true },
    select: { id: true },
  });
  const selectableReasons = await db.changeReason.findMany({
    where: id
      ? {
          OR: [
            { active: true },
            { requests: { some: { changeRequestId: id } } },
          ],
        }
      : { active: true },
    select: { id: true },
  });
  const parsed = (
    intent === "submit"
      ? submissionSchema(
          other?.id,
          new Set(selectableReasons.map((reason) => reason.id)),
        )
      : draftSchema
  ).safeParse(input);
  if (!parsed.success) return errorsOf(parsed.error);
  let requestId = id;

  await db.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.changeRequest.findUniqueOrThrow({
        where: { id },
        select: {
          applicantId: true,
          status: true,
          version: true,
          approvalCycle: true,
        },
      });
      requireDraftEdit(user, existing);
      const updated = await tx.changeRequest.updateMany({
        where: { id, version: parsed.data.version, status: existing.status },
        data: {
          title: parsed.data.title,
          ...editableApplicant(parsed.data.applicantName),
          machineTypeId: parsed.data.machineTypeId || null,
          articleNumber: parsed.data.articleNumber || null,
          articleDescription: parsed.data.articleDescription || null,
          description: parsed.data.description,
          otherReasonText: parsed.data.otherReasonText || null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new Error(
          "Der Antrag wurde zwischenzeitlich geändert. Laden Sie die Seite neu.",
        );
      await tx.changeRequestReason.deleteMany({
        where: { changeRequestId: id },
      });
      if (parsed.data.reasonIds.length)
        await tx.changeRequestReason.createMany({
          data: parsed.data.reasonIds.map((changeReasonId) => ({
            changeRequestId: id,
            changeReasonId,
          })),
        });
      await tx.auditEvent.create({
        data: {
          changeRequestId: id,
          userId: user.id,
          action: "CHANGE_REQUEST_UPDATED",
          entityType: "ChangeRequest",
          entityId: id,
          summary: "Entwurf aktualisiert",
          details: { version: existing.version + 1 },
        },
      });
      if (
        existing.status === "CHANGES_REQUESTED" &&
        (await tx.auditEvent.count({
          where: {
            changeRequestId: id,
            action: "REVISION_STARTED",
            details: {
              path: ["approvalCycle"],
              equals: existing.approvalCycle,
            },
          },
        })) === 0
      )
        await tx.auditEvent.create({
          data: {
            changeRequestId: id,
            userId: user.id,
            action: "REVISION_STARTED",
            entityType: "ChangeRequest",
            entityId: id,
            summary: `${user.name} hat die Überarbeitung des Änderungsantrags begonnen.`,
            details: { approvalCycle: existing.approvalCycle },
          },
        });
    } else {
      const number = await generateChangeRequestNumber(tx);
      const created = await tx.changeRequest.create({
        data: {
          number,
          title: parsed.data.title,
          ...creatorAndApplicant(user.id, parsed.data.applicantName),
          machineTypeId: parsed.data.machineTypeId || null,
          articleNumber: parsed.data.articleNumber || null,
          articleDescription: parsed.data.articleDescription || null,
          description: parsed.data.description,
          otherReasonText: parsed.data.otherReasonText || null,
          reasons: {
            create: parsed.data.reasonIds.map((changeReasonId) => ({
              changeReasonId,
            })),
          },
        },
      });
      requestId = created.id;
      await tx.auditEvent.create({
        data: {
          changeRequestId: created.id,
          userId: user.id,
          action: "CHANGE_REQUEST_CREATED",
          entityType: "ChangeRequest",
          entityId: created.id,
          summary: `${user.name} hat den Änderungsantrag ${number} als Entwurf erstellt.`,
          details: { applicantName: parsed.data.applicantName },
        },
      });
    }
    if (intent === "submit") {
      const current = await tx.changeRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { status: true, approvalCycle: true },
      });
      const cycle =
        current.status === "CHANGES_REQUESTED"
          ? current.approvalCycle + 1
          : current.approvalCycle;
      const submission = submissionData(new Date(), cycle);
      await tx.changeRequest.update({
        where: { id: requestId },
        data: {
          ...submission.request,
          approvalCycle: cycle,
          version: { increment: 1 },
        },
      });
      await tx.approval.createMany({
        data: submission.approvals.map((approval) => ({
          changeRequestId: requestId,
          ...approval,
        })),
      });
      const resubmitted = cycle > 1;
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          action: resubmitted
            ? "REVISED_REQUEST_SUBMITTED"
            : submission.audit.action,
          entityType: "ChangeRequest",
          entityId: requestId,
          summary: resubmitted
            ? `${user.name} hat den Änderungsantrag überarbeitet und erneut eingereicht.`
            : submission.audit.summary,
          details: { status: "UNDER_REVIEW", approvalCycle: cycle },
        },
      });
      if (resubmitted)
        await tx.auditEvent.create({
          data: {
            changeRequestId: requestId,
            userId: user.id,
            action: "APPROVAL_CYCLE_CREATED",
            entityType: "Approval",
            entityId: requestId,
            summary: `Freigaberunde ${cycle} mit offenen AVOR- und Technikfreigaben erstellt.`,
            details: { approvalCycle: cycle },
          },
        });
    }
  });

  const files = formData
    .getAll("attachments")
    .filter((item): item is File => item instanceof File && item.size > 0);
  for (const file of files)
    await uploadAttachmentForRequest(requestId, user.id, file);
  revalidatePath("/");
  revalidatePath("/change-requests");
  redirect(`/change-requests/${requestId}`);
}

async function uploadAttachmentForRequest(
  requestId: string,
  userId: string,
  file: File,
) {
  const attachmentId = randomUUID();
  const key = supabaseObjectKey(requestId, attachmentId, file.name);
  await uploadNewAttachment(file, key);
  try { await db.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        id: attachmentId,
        changeRequestId: requestId,
        originalName: file.name,
        storageKey: key,
        storageProvider: "SUPABASE",
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: userId,
      },
    });
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId,
        action: "ATTACHMENT_UPLOADED",
        entityType: "Attachment",
        entityId: attachment.id,
        summary: `Anhang «${file.name}» hochgeladen`,
        details: { sizeBytes: file.size, mimeType: file.type },
      },
    });
  }); } catch (error) { await cleanupUploadedAttachment(key); throw error; }
}

export async function uploadAttachment(requestId: string, formData: FormData) {
  const user = await getCurrentUser();
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { applicantId: true, status: true },
  });
  requireDraftEdit(user, request);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Keine Datei ausgewählt.");
  await uploadAttachmentForRequest(requestId, user.id, file);
  revalidatePath(`/change-requests/${requestId}`);
}

export async function removeAttachment(attachmentId: string) {
  const user = await getCurrentUser();
  const attachment = await db.attachment.findUniqueOrThrow({
    where: { id: attachmentId },
    include: {
      changeRequest: { select: { id: true, applicantId: true, status: true } },
    },
  });
  requireDraftEdit(user, attachment.changeRequest);
  await removeStoredAttachment(attachment.storageProvider, attachment.storageKey);
  await db.$transaction(async (tx) => {
    await tx.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        changeRequestId: attachment.changeRequest.id,
        userId: user.id,
        action: "ATTACHMENT_REMOVED",
        entityType: "Attachment",
        entityId: attachmentId,
        summary: `Anhang «${attachment.originalName}» entfernt`,
      },
    });
  });
  revalidatePath(`/change-requests/${attachment.changeRequest.id}`);
}

export async function submitExistingRequest(requestId: string) {
  const user = await getCurrentUser();
  const request = await db.changeRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { reasons: true },
  });
  requireDraftEdit(user, request);
  const other = await db.changeReason.findFirst({
    where: { isOther: true, active: true },
    select: { id: true },
  });
  const allowedReasonIds = new Set(
    (
      await db.changeReason.findMany({
        where: {
          OR: [
            { active: true },
            { requests: { some: { changeRequestId: requestId } } },
          ],
        },
        select: { id: true },
      })
    ).map((reason) => reason.id),
  );
  submissionSchema(other?.id, allowedReasonIds).parse({
    applicantName: request.applicantName,
    title: request.title,
    machineTypeId: request.machineTypeId ?? "",
    articleNumber: request.articleNumber ?? "",
    articleDescription: request.articleDescription ?? "",
    reasonIds: request.reasons.map((reason) => reason.changeReasonId),
    otherReasonText: request.otherReasonText ?? "",
    description: request.description,
    version: request.version,
  });
  const cycle =
    request.status === "CHANGES_REQUESTED"
      ? request.approvalCycle + 1
      : request.approvalCycle;
  const submission = submissionData(new Date(), cycle);
  await db.$transaction(async (tx) => {
    const updated = await tx.changeRequest.updateMany({
      where: {
        id: requestId,
        version: request.version,
        status: request.status,
      },
      data: {
        ...submission.request,
        approvalCycle: cycle,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1)
      throw new Error(
        "Der Antrag wurde zwischenzeitlich geändert. Laden Sie die Seite neu.",
      );
    await tx.approval.createMany({
      data: submission.approvals.map((approval) => ({
        changeRequestId: requestId,
        ...approval,
      })),
    });
    const resubmitted = cycle > 1;
    await tx.auditEvent.create({
      data: {
        changeRequestId: requestId,
        userId: user.id,
        action: resubmitted
          ? "REVISED_REQUEST_SUBMITTED"
          : submission.audit.action,
        entityType: "ChangeRequest",
        entityId: requestId,
        summary: resubmitted
          ? `${user.name} hat den Änderungsantrag überarbeitet und erneut eingereicht.`
          : submission.audit.summary,
        details: { status: "UNDER_REVIEW", approvalCycle: cycle },
      },
    });
    if (resubmitted)
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          action: "APPROVAL_CYCLE_CREATED",
          entityType: "Approval",
          entityId: requestId,
          summary: `Freigaberunde ${cycle} mit offenen AVOR- und Technikfreigaben erstellt.`,
          details: { approvalCycle: cycle },
        },
      });
  });
  revalidatePath("/");
  revalidatePath("/change-requests");
  redirect(`/change-requests/${requestId}`);
}
