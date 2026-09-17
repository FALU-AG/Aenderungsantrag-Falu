"use server";

import { getWritingProvider } from "@/modules/ai/provider";
import { getSessionUser } from "@/modules/auth";
import { getSpeechProvider } from "@/modules/speech/provider";

export type AssistResult = { text?: string; message?: string };

export const MAX_SPEECH_AUDIO_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_SPEECH_AUDIO_TYPES = new Set([
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

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

  const contentType = audio.type.toLowerCase().split(";", 1)[0];
  if (!SUPPORTED_SPEECH_AUDIO_TYPES.has(contentType))
    return { message: "Das Audioformat der Aufnahme wird nicht unterstützt." };

  const provider = getSpeechProvider();
  if (!provider)
    return { message: "Spracheingabe ist derzeit nicht konfiguriert." };

  try {
    const text = await provider.transcribe(audio);
    if (!text) return { message: "In der Aufnahme wurde kein Text erkannt." };
    return { text };
  } catch {
    console.error("Speech transcription failed.");
    return { message: "Die Spracheingabe konnte nicht verarbeitet werden." };
  }
}
