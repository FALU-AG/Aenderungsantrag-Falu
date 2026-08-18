"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, FilePlus2, Trash2 } from "lucide-react";

export type Preview = { file: File; url?: string };

export const isImagePreviewable = (file: File) =>
  file.type.startsWith("image/");
export const removePreviewAt = (previews: Preview[], index: number) =>
  previews.filter((_, itemIndex) => itemIndex !== index);

export function AttachmentPicker({
  fieldName = "attachments",
  multiple = true,
}: {
  fieldName?: string;
  multiple?: boolean;
}) {
  const [files, setFiles] = useState<Preview[]>([]);
  const regularInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function add(selected: FileList | null) {
    if (!selected) return;
    setFiles((current) => {
      const additions = Array.from(selected).map((file) => {
        const url = isImagePreviewable(file)
          ? URL.createObjectURL(file)
          : undefined;
        if (url) previewUrls.current.add(url);
        return { file, url };
      });
      if (!multiple)
        current.forEach((item) => {
          if (item.url) {
            URL.revokeObjectURL(item.url);
            previewUrls.current.delete(item.url);
          }
        });
      const next = multiple ? [...current, ...additions] : additions.slice(-1);
      syncInput(next);
      return next;
    });
  }

  function remove(index: number) {
    setFiles((current) => {
      const item = current[index];
      if (item.url) {
        URL.revokeObjectURL(item.url);
        previewUrls.current.delete(item.url);
      }
      const next = removePreviewAt(current, index);
      syncInput(next);
      return next;
    });
  }

  function syncInput(next: Preview[]) {
    if (!regularInput.current || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    next.forEach((item) => transfer.items.add(item.file));
    regularInput.current.files = transfer.files;
    if (cameraInput.current) cameraInput.current.value = "";
  }

  const inputClass = "sr-only";
  return (
    <div>
      <input
        ref={regularInput}
        name={fieldName}
        type="file"
        multiple={multiple}
        accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
        className={inputClass}
        onChange={(event) => add(event.target.files)}
      />
      <input
        ref={cameraInput}
        name={fieldName}
        type="file"
        accept="image/*"
        capture="environment"
        className={inputClass}
        onChange={(event) => add(event.target.files)}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => regularInput.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91]"
        >
          <FilePlus2 className="size-4" aria-hidden="true" />
          Datei hinzufügen
        </button>
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91]"
        >
          <Camera className="size-4" aria-hidden="true" />
          Foto aufnehmen
        </button>
      </div>
      {files.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {files.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              {item.url ? (
                <Image
                  src={item.url}
                  alt="Vorschau der ausgewählten Aufnahme"
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded object-cover"
                />
              ) : (
                <FilePlus2
                  className="size-8 text-slate-400"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`${item.file.name} entfernen`}
                className="grid min-h-10 min-w-10 place-items-center rounded-md text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
