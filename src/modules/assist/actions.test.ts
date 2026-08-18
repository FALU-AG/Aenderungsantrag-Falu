import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/provider", () => ({ getWritingProvider: vi.fn() }));
vi.mock("@/modules/speech/provider", () => ({ getSpeechProvider: vi.fn() }));

import { getWritingProvider } from "@/modules/ai/provider";
import { getSpeechProvider } from "@/modules/speech/provider";
import { formulateText, transcribeSpeech } from "./actions";

describe("sichere Providerfehler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("liefert bei AI-Fehlern nur eine sichere deutsche Meldung", async () => {
    vi.mocked(getWritingProvider).mockReturnValue({
      formulate: vi.fn().mockRejectedValue(new Error("secret provider detail")),
    });
    await expect(formulateText("Notiz", "Titel")).resolves.toEqual({
      message: "AI-Unterstützung konnte derzeit nicht ausgeführt werden.",
    });
  });

  it("liefert bei Transkriptionsfehlern nur eine sichere deutsche Meldung", async () => {
    vi.mocked(getSpeechProvider).mockReturnValue({
      transcribe: vi
        .fn()
        .mockRejectedValue(new Error("secret provider detail")),
    });
    const data = new FormData();
    data.set(
      "audio",
      new File(["audio"], "aufnahme.webm", { type: "audio/webm" }),
    );
    await expect(transcribeSpeech(data)).resolves.toEqual({
      message: "Die Spracheingabe konnte nicht verarbeitet werden.",
    });
  });
});
