import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db/client";
import {
  cleanupUploadedAttachment,
  supabaseObjectKey,
  uploadNewAttachment,
} from "@/server/storage/attachment-storage";

type AttachmentDatabase = Pick<typeof db, "$transaction">;
type Upload = (file: File, key: string) => Promise<void>;
type Cleanup = (key: string) => Promise<void>;

export type PersistAttachmentOptions = {
  database?: AttachmentDatabase;
  upload?: Upload;
  cleanup?: Cleanup;
  createId?: () => string;
};

export async function persistAttachmentUpload(
  requestId: string,
  userId: string,
  file: File,
  options: PersistAttachmentOptions = {},
) {
  const database = options.database ?? db;
  const upload = options.upload ?? uploadNewAttachment;
  const cleanup = options.cleanup ?? cleanupUploadedAttachment;
  const attachmentId = (options.createId ?? randomUUID)();
  const key = supabaseObjectKey(requestId, attachmentId, file.name);

  await upload(file, key);
  try {
    return await database.$transaction(async (tx) => {
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
          details: { sizeBytes: file.size, mimeType: file.type } as Prisma.InputJsonValue,
        },
      });
      return attachment;
    });
  } catch (error) {
    await cleanup(key);
    throw error;
  }
}
