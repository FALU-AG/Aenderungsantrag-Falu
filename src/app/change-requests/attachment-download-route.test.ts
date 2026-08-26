import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), requirePermission: vi.fn(), findFirst: vi.fn(), read: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/modules/authorization/permissions", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/db/client", () => ({ db: { attachment: { findFirst: mocks.findFirst } } }));
vi.mock("@/server/storage/attachment-storage", () => ({ readStoredAttachment: mocks.read }));

import { GET } from "./[id]/attachments/[attachmentId]/route";

const context = { params: Promise.resolve({ id: "cr-1", attachmentId: "att-1" }) } as never;

describe("authenticated attachment download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "u1", roles: ["EMPLOYEE"] });
    mocks.findFirst.mockResolvedValue({ id: "att-1", storageProvider: "SUPABASE", storageKey: "change-requests/cr-1/att-1/file.pdf", mimeType: "application/pdf", originalName: "Prüfung.pdf" });
    mocks.read.mockResolvedValue(Buffer.from("content"));
  });

  it("liefert nur die durch Request- und Attachment-ID aufgelöste private Datei", async () => {
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(encodeURIComponent("Prüfung.pdf"));
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "att-1", changeRequestId: "cr-1", deletedAt: null } });
    expect(mocks.read).toHaveBeenCalledWith("SUPABASE", "change-requests/cr-1/att-1/file.pdf");
  });

  it("liefert 404 für fehlende Metadaten oder fehlende Storage-Objekte", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
    mocks.read.mockRejectedValueOnce(new Error("missing"));
    expect((await GET(new Request("http://localhost"), context)).status).toBe(404);
  });

  it("prüft Authentifizierung und Berechtigung vor dem Storage-Zugriff", async () => {
    mocks.requirePermission.mockImplementationOnce(() => { throw new Error("forbidden"); });
    await expect(GET(new Request("http://localhost"), context)).rejects.toThrow("forbidden");
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
