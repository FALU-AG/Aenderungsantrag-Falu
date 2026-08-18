import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { getSpeechProvider, OpenAISpeechProvider } from "./provider";

describe("OpenAI-Spracheingabe", () => {
  it("sendet Browser-Audio mit deutscher Sprache an den Transcription-Endpunkt", async () => {
    const create = vi.fn().mockResolvedValue({ text: "Transkribierter Text." });
    const client = { audio: { transcriptions: { create } } } as unknown as Pick<
      OpenAI,
      "audio"
    >;
    const audio = new File(["audio"], "aufnahme.webm", { type: "audio/webm" });
    const provider = new OpenAISpeechProvider(client);
    await expect(provider.transcribe(audio)).resolves.toBe(
      "Transkribierter Text.",
    );
    expect(create).toHaveBeenCalledWith({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      language: "de",
    });
  });

  it("wählt OpenAI nur mit API-Schlüssel", () => {
    expect(getSpeechProvider({ SPEECH_PROVIDER: "openai" })).toBeNull();
    const client = {
      audio: { transcriptions: { create: vi.fn() } },
    } as unknown as Pick<OpenAI, "audio">;
    expect(
      getSpeechProvider(
        { SPEECH_PROVIDER: "openai", OPENAI_API_KEY: "test-key" },
        client,
      ),
    ).toBeInstanceOf(OpenAISpeechProvider);
  });
});
