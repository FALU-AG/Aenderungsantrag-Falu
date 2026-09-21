import type { StorageProvider } from "@prisma/client";
import { removeAttachmentFile } from "./local-storage";
import { createSupabaseStorageClient, removeSupabaseObject } from "./supabase-storage-node";

/** Node/tsx-safe adapter for maintenance scripts. Application code uses attachment-storage.ts. */
export async function removeStoredAttachmentNode(provider: StorageProvider, key: string) {
  if (provider === "LOCAL") return removeAttachmentFile(key);
  return removeSupabaseObject(createSupabaseStorageClient(), key);
}
