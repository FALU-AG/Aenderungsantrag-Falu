import "server-only";

import OpenAI from "openai";

export interface SpeechProvider {
  transcribe(audio: File): Promise<string>;
}

type TranscriptionClient = Pick<OpenAI, "audio">;

export class OpenAISpeechProvider implements SpeechProvider {
  constructor(
    private readonly client: TranscriptionClient,
    private readonly model = "gpt-4o-mini-transcribe",
  ) {}

  async transcribe(audio: File) {
    const result = await this.client.audio.transcriptions.create({
      file: audio,
      model: this.model,
      language: "de",
    });
    return result.text.trim();
  }
}

class MockSpeechProvider implements SpeechProvider {
  async transcribe() {
    return "Mock-Transkription für die lokale Entwicklung.";
  }
}

export function getSpeechProvider(
  env: Partial<Record<string, string | undefined>> = process.env,
  client?: TranscriptionClient,
): SpeechProvider | null {
  const provider = env.SPEECH_PROVIDER || env.AI_PROVIDER;
  if (provider === "mock") return new MockSpeechProvider();
  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) return null;
    return new OpenAISpeechProvider(
      client ??
        new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          timeout: 30_000,
          maxRetries: 1,
        }),
      env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    );
  }
  return null;
}
