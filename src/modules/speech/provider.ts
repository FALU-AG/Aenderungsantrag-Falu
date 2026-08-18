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
  if (env.SPEECH_PROVIDER === "mock") return new MockSpeechProvider();
  if (env.SPEECH_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) return null;
    return new OpenAISpeechProvider(
      client ?? new OpenAI({ apiKey: env.OPENAI_API_KEY }),
      env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
    );
  }
  return null;
}
