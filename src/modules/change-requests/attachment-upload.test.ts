import { describe, expect, it, vi } from "vitest";
import { validateAttachment } from "@/server/storage/local-storage";
import { persistAttachmentUpload } from "./attachment-upload";

function fixture(options: { dbFails?: boolean; uploadFails?: boolean } = {}) {
  const attachmentCreate = vi.fn(async ({ data }) => {
    if (options.dbFails) throw new Error("database unavailable");
    return data;
  });
  const auditCreate = vi.fn(async () => ({ id: "audit" }));
  const tx = { attachment: { create: attachmentCreate }, auditEvent: { create: auditCreate } };
  const database = { $transaction: vi.fn(async (operation) => operation(tx)) };
  const upload = vi.fn(async () => { if (options.uploadFails) throw new Error("storage unavailable"); });
  const cleanup = vi.fn(async () => undefined);
  return { database, attachmentCreate, auditCreate, upload, cleanup };
}

describe("persistAttachmentUpload", () => {
  const file = new File(["pdf"], "../Prüfung Plan.PDF", { type: "application/pdf" });

  it("lädt privat hoch und persistiert die vollständigen Metadaten mit sicherem Pfad", async () => {
    const f = fixture();
    await persistAttachmentUpload("request-1", "user-1", file, { ...f, createId: () => "attachment-1" });
    const key = "change-requests/request-1/attachment-1/Pru-fung-Plan.pdf";
    expect(f.upload).toHaveBeenCalledWith(file, key);
    expect(f.attachmentCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "attachment-1", changeRequestId: "request-1", storageKey: key, storageProvider: "SUPABASE", uploadedById: "user-1" }) });
    expect(f.auditCreate).toHaveBeenCalled();
  });

  it("entfernt das hochgeladene Objekt, wenn die DB-Persistierung fehlschlägt", async () => {
    const f = fixture({ dbFails: true });
    await expect(persistAttachmentUpload("request-1", "user-1", file, { ...f, createId: () => "attachment-1" })).rejects.toThrow("database unavailable");
    expect(f.cleanup).toHaveBeenCalledWith("change-requests/request-1/attachment-1/Pru-fung-Plan.pdf");
  });

  it("legt bei einem Storage-Fehler keine Metadaten an", async () => {
    const f = fixture({ uploadFails: true });
    await expect(persistAttachmentUpload("request-1", "user-1", file, { ...f })).rejects.toThrow("storage unavailable");
    expect(f.database.$transaction).not.toHaveBeenCalled();
    expect(f.cleanup).not.toHaveBeenCalled();
  });

  it("weist nicht unterstützte und zu grosse Dateien vor einem Upload ab", async () => {
    const upload = vi.fn(async (candidate: File) => validateAttachment(candidate));
    await expect(persistAttachmentUpload("r", "u", new File(["x"], "x.exe", { type: "application/octet-stream" }), { upload })).rejects.toThrow("Dateityp nicht erlaubt");
    await expect(persistAttachmentUpload("r", "u", new File([new Uint8Array(20 * 1024 * 1024 + 1)], "x.pdf", { type: "application/pdf" }), { upload })).rejects.toThrow("20 MB");
  });
});
