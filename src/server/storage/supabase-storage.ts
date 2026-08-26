import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ATTACHMENT_BUCKET = "change-request-attachments";

export type SupabaseStorageEnvironment = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
export function createSupabaseStorageClient(environment?: SupabaseStorageEnvironment) {
  const url = (environment?.SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  const key = (environment?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) throw new Error("Supabase Storage ist nicht konfiguriert. SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden benötigt.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export type StorageClient = Pick<SupabaseClient, "storage">;
export async function uploadSupabaseObject(client: StorageClient, key: string, data: Buffer, mimeType: string) {
  const { error } = await client.storage.from(ATTACHMENT_BUCKET).upload(key, data, { contentType: mimeType, upsert: false });
  if (error) throw new Error("Der Anhang konnte nicht hochgeladen werden.");
}
export async function downloadSupabaseObject(client: StorageClient, key: string) {
  const { data, error } = await client.storage.from(ATTACHMENT_BUCKET).download(key);
  if (error || !data) throw new Error("Anhang ist nicht mehr verfügbar.");
  return Buffer.from(await data.arrayBuffer());
}
export async function removeSupabaseObject(client: StorageClient, key: string) {
  const { error } = await client.storage.from(ATTACHMENT_BUCKET).remove([key]);
  if (error) throw new Error("Anhang konnte nicht aus dem Speicher entfernt werden.");
}
