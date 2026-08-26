import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttachmentOverviewCard, attachmentTypeLabel, formatAttachmentSize } from "./attachment-overview-card";

const attachments = [
  { id: "a1", originalName: "Montagezeichnung.pdf", mimeType: "application/pdf", sizeBytes: 245 * 1024, uploadedAt: new Date("2026-08-26T08:15:00Z") },
  { id: "a2", originalName: "Foto.jpg", mimeType: "image/jpeg", sizeBytes: 1.8 * 1024 * 1024, uploadedAt: new Date("2026-08-25T07:00:00Z") },
];

afterEach(cleanup);

describe("AttachmentOverviewCard", () => {
  it("zeigt Anzahl, Dateinamen, MIME-Typen, formatierte Grössen und Uploaddatum", () => {
    render(<AttachmentOverviewCard requestId="cr-1" attachments={attachments} />);
    expect(screen.getByRole("heading", { name: "Anhänge (2)" })).toBeInTheDocument();
    expect(screen.getByText("Montagezeichnung.pdf")).toBeInTheDocument();
    expect(screen.getByText("Foto.jpg")).toBeInTheDocument();
    expect(screen.getByText(/PDF · 245 KB · Hochgeladen/)).toBeInTheDocument();
    expect(screen.getByText(/JPEG · 1.8 MB · Hochgeladen/)).toBeInTheDocument();
    expect(screen.getByText(/26.08.2026, 10:15/)).toBeInTheDocument();
  });

  it("verlinkt jede Datei ausschließlich über die authentifizierte Anwendungsroute", () => {
    render(<AttachmentOverviewCard requestId="cr-1" attachments={attachments} />);
    expect(screen.getAllByRole("link", { name: "Öffnen" }).map((link) => link.getAttribute("href"))).toEqual([
      "/change-requests/cr-1/attachments/a1",
      "/change-requests/cr-1/attachments/a2",
    ]);
  });

  it("verlinkt den unveränderten vollständigen Anhänge-Tab", () => {
    render(<AttachmentOverviewCard requestId="cr-1" attachments={attachments} />);
    expect(screen.getByRole("link", { name: "Alle Anhänge anzeigen" })).toHaveAttribute("href", "?tab=Anh%C3%A4nge");
  });

  it("zeigt einen zurückhaltenden Leerzustand ohne Vollansicht-Link", () => {
    render(<AttachmentOverviewCard requestId="cr-1" attachments={[]} />);
    expect(screen.getByText("Keine Anhänge vorhanden.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alle Anhänge anzeigen" })).not.toBeInTheDocument();
  });

  it("bildet gespeicherte MIME-Typen freundlich ab und formatiert Bytegrössen", () => {
    expect(attachmentTypeLabel("image/png")).toBe("PNG");
    expect(attachmentTypeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("Word");
    expect(attachmentTypeLabel("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Excel");
    expect(formatAttachmentSize(500)).toBe("500 B");
    expect(formatAttachmentSize(245 * 1024)).toBe("245 KB");
  });
});
