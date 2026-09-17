"use server";

import { getWritingProvider } from "@/modules/ai/provider";
import { getSessionUser } from "@/modules/auth";
import { getSpeechProvider } from "@/modules/speech/provider";
import {
  isSupportedSpeechContentType,
  MAX_SPEECH_AUDIO_BYTES,
} from "./speech-validation";

export type AssistResult = { text?: string; message?: string };

function safeTranscriptionErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { name: "UnknownError" };
  const record = error as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message
          .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
          .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
          .slice(0, 500)
      : undefined;
  return {
    name: typeof record.name === "string" ? record.name : "Error",
    status:
      typeof record.status === "number" || typeof record.status === "string"
        ? record.status
        : undefined,
    code:
      typeof record.code === "string" || typeof record.code === "number"
        ? record.code
        : undefined,
    message,
  };
}

export async function formulateText(
  notes: string,
  fieldLabel: string,
  context?: string,
): Promise<AssistResult> {
  const provider = getWritingProvider();
  if (!provider)
    return { message: "AI-Unterstützung ist derzeit nicht konfiguriert." };
  if (!notes.trim())
    return {
      message: "Bitte geben Sie zuerst Stichworte oder einen Entwurf ein.",
    };
  try {
    return { text: await provider.formulate({ notes, fieldLabel, context }) };
  } catch (error) {
    console.error("OpenAI writing provider failed", error);
    return {
      message: "AI-Unterstützung konnte derzeit nicht ausgeführt werden.",
    };
  }
}

export async function transcribeSpeech(
  formData: FormData,
): Promise<AssistResult> {
  const user = await getSessionUser();
  if (!user)
    return { message: "Bitte melden Sie sich erneut an, um die Spracheingabe zu verwenden." };

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0)
    return { message: "Es wurde keine Aufnahme übermittelt." };
  if (audio.size > MAX_SPEECH_AUDIO_BYTES)
    return { message: "Die Aufnahme ist zu groß. Maximal erlaubt sind 10 MB." };

  if (!isSupportedSpeechContentType(audio.type))
    return { message: "Das Audioformat der Aufnahme wird nicht unterstützt." };

  const provider = getSpeechProvider();
  if (!provider)
    return { message: "Spracheingabe ist derzeit nicht konfiguriert." };

  try {
    const text = await provider.transcribe(audio);
    if (!text) return { message: "In der Aufnahme wurde kein Text erkannt." };
    return { text };
  } catch (error) {
    console.error("Speech input failed.", {
      stage: "openai_transcription",
      ...safeTranscriptionErrorDetails(error),
    });
    return { message: "Die Spracheingabe konnte nicht verarbeitet werden." };
  }
}
