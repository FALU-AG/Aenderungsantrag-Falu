import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateTimeZurich } from "@/lib/date-time";

export type AttachmentOverviewItem = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
};

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

export function attachmentTypeLabel(mimeType: string) {
  return MIME_LABELS[mimeType] ?? "Datei";
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentOverviewCard({
  requestId,
  attachments,
}: {
  requestId: string;
  attachments: AttachmentOverviewItem[];
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Paperclip className="size-4 text-slate-500" aria-hidden="true" />
          {attachments.length ? `Anhänge (${attachments.length})` : "Anhänge"}
        </h2>
        {attachments.length > 0 && (
          <Link
            href={`?tab=${encodeURIComponent("Anhänge")}`}
            className="text-sm font-medium text-[#175f91] hover:underline"
          >
            Alle Anhänge anzeigen
          </Link>
        )}
      </div>
      {attachments.length ? (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-900">
                  {attachment.originalName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {attachmentTypeLabel(attachment.mimeType)} · {formatAttachmentSize(attachment.sizeBytes)} · Hochgeladen {formatDateTimeZurich(attachment.uploadedAt)}
                </p>
              </div>
              <a
                href={`/change-requests/${requestId}/attachments/${attachment.id}`}
                className="w-fit shrink-0 text-sm font-semibold text-[#175f91] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91]"
              >
                Öffnen
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Keine Anhänge vorhanden.</p>
      )}
    </Card>
  );
}
