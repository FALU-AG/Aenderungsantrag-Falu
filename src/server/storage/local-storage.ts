import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const root = path.resolve(process.cwd(), "storage", "attachments");

export function validateAttachment(file: File) {
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) throw new Error("Dateityp nicht erlaubt. Zulässig sind PDF, PNG, JPG, DOCX und XLSX.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Die Datei darf höchstens 20 MB gross sein.");
  if (file.size === 0) throw new Error("Die Datei ist leer.");
}

export async function storeAttachment(file: File) {
  validateAttachment(file); await mkdir(root, { recursive: true });
  const extension = path.extname(file.name).toLowerCase(); const storageKey = `${randomUUID()}${extension}`;
  await writeFile(path.join(root, storageKey), Buffer.from(await file.arrayBuffer())); return storageKey;
}
export const readAttachment = (key: string) => readFile(path.join(root, path.basename(key)));
export const removeAttachmentFile = (key: string) => unlink(path.join(root, path.basename(key))).catch(() => undefined);
