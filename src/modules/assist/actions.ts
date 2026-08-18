"use server";

import { getWritingProvider } from "@/modules/ai/provider";
import { getSpeechProvider } from "@/modules/speech/provider";

export type AssistResult = { text?: string; message?: string };

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
  const provider = getSpeechProvider();
  if (!provider)
    return { message: "Spracheingabe ist derzeit nicht konfiguriert." };
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0)
    return { message: "Es wurde keine Aufnahme übermittelt." };
  try {
    return { text: await provider.transcribe(audio) };
  } catch (error) {
    console.error("Speech provider failed", error);
    return { message: "Die Spracheingabe konnte nicht verarbeitet werden." };
  }
}
