import "server-only";
import path from "node:path";
import { readAttachment, removeAttachmentFile, validateAttachment } from "./local-storage";
import { createSupabaseStorageClient, downloadSupabaseObject, removeSupabaseObject, uploadSupabaseObject } from "./supabase-storage";

export type AttachmentStorageProvider = "LOCAL" | "SUPABASE";
export function safeFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(filename, path.extname(filename)).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "datei";
  return `${base}${extension}`;
}
export function supabaseObjectKey(changeRequestId: string, attachmentId: string, filename: string) {
  return `change-requests/${changeRequestId}/${attachmentId}/${safeFilename(filename)}`;
}
export async function uploadNewAttachment(file: File, key: string) {
  validateAttachment(file);
  const client = createSupabaseStorageClient();
  await uploadSupabaseObject(client, key, Buffer.from(await file.arrayBuffer()), file.type);
}
export async function readStoredAttachment(provider: AttachmentStorageProvider, key: string) {
  return provider === "LOCAL" ? readAttachment(key) : downloadSupabaseObject(createSupabaseStorageClient(), key);
}
export async function removeStoredAttachment(provider: AttachmentStorageProvider, key: string) {
  if (provider === "LOCAL") return removeAttachmentFile(key);
  return removeSupabaseObject(createSupabaseStorageClient(), key);
}
export async function cleanupUploadedAttachment(key: string) {
  try { await removeSupabaseObject(createSupabaseStorageClient(), key); } catch (error) { console.error("Supabase attachment cleanup failed.", error instanceof Error ? error.message : "Unknown storage error"); }
}
