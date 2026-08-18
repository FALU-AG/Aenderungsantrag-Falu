"use client";

import { useRef, useState } from "react";
import { Mic, Sparkles, Square } from "lucide-react";
import { formulateText, transcribeSpeech } from "@/modules/assist/actions";
import {
  applyAcceptedSuggestion,
  microphoneAccessMessage,
} from "@/modules/assist/behavior";

type Props = {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
  context?: string;
};

export function AssistedTextField({
  name,
  label,
  defaultValue,
  required,
  multiline,
  rows = 4,
  disabled,
  error,
  maxLength,
  context,
}: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);

  async function formulate() {
    setBusy(true);
    setMessage(undefined);
    const result = await formulateText(value, label, context);
    setPreview(result.text);
    setMessage(result.message);
    setBusy(false);
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMessage(microphoneAccessMessage);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) =>
        event.data.size && chunks.push(event.data);
      mediaRecorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        setBusy(true);
        const data = new FormData();
        data.set(
          "audio",
          new File(chunks, "aufnahme.webm", {
            type: mediaRecorder.mimeType || "audio/webm",
          }),
        );
        const result = await transcribeSpeech(data);
        if (result.text)
          setValue((current) =>
            [current.trim(), result.text].filter(Boolean).join(" "),
          );
        setMessage(result.message);
        setBusy(false);
      };
      mediaRecorder.start();
      setRecording(true);
      setMessage("Aufnahme läuft …");
    } catch {
      setMessage(microphoneAccessMessage);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";
  const common = {
    name,
    value,
    required,
    disabled,
    maxLength,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setValue(event.target.value),
    className: fieldClass,
  };

  return (
    <div className="block">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      {multiline ? (
        <textarea id={name} rows={rows} {...common} />
      ) : (
        <input id={name} {...common} />
      )}
      {!disabled && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={formulate}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91]"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Mit AI formulieren
          </button>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91]"
          >
            {recording ? (
              <Square className="size-4" aria-hidden="true" />
            ) : (
              <Mic className="size-4" aria-hidden="true" />
            )}
            {recording ? "Aufnahme stoppen" : "Spracheingabe"}
          </button>
        </div>
      )}
      {message && (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {message}
        </p>
      )}
      {preview !== undefined && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase text-blue-800">
            AI-Vorschau
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{preview}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setValue(applyAcceptedSuggestion(value, preview, true));
                setPreview(undefined);
              }}
              className="rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
            >
              Übernehmen
            </button>
            <button
              type="button"
              onClick={() => setPreview(undefined)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
