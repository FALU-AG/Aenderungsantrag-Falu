import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/provider", () => ({ getWritingProvider: vi.fn() }));
vi.mock("@/modules/speech/provider", () => ({ getSpeechProvider: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getSessionUser: vi.fn() }));

import { getWritingProvider } from "@/modules/ai/provider";
import { getSessionUser } from "@/modules/auth";
import { getSpeechProvider } from "@/modules/speech/provider";
import {
  formulateText,
  MAX_SPEECH_AUDIO_BYTES,
  transcribeSpeech,
} from "./actions";

describe("sichere Providerfehler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1" } as never);
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

  it("schützt die Transkription serverseitig durch die Sitzung", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
    const data = new FormData();
    data.set("audio", new File(["audio"], "aufnahme.webm", { type: "audio/webm" }));

    await expect(transcribeSpeech(data)).resolves.toEqual({
      message: "Bitte melden Sie sich erneut an, um die Spracheingabe zu verwenden.",
    });
    expect(getSpeechProvider).not.toHaveBeenCalled();
  });

  it("weist nicht unterstützte und zu große Audiodateien vor dem Provider-Aufruf ab", async () => {
    const unsupported = new FormData();
    unsupported.set("audio", new File(["audio"], "aufnahme.txt", { type: "text/plain" }));
    await expect(transcribeSpeech(unsupported)).resolves.toEqual({
      message: "Das Audioformat der Aufnahme wird nicht unterstützt.",
    });

    const oversized = new FormData();
    oversized.set(
      "audio",
      new File([new Uint8Array(MAX_SPEECH_AUDIO_BYTES + 1)], "aufnahme.webm", {
        type: "audio/webm",
      }),
    );
    await expect(transcribeSpeech(oversized)).resolves.toEqual({
      message: "Die Aufnahme ist zu groß. Maximal erlaubt sind 10 MB.",
    });
    expect(getSpeechProvider).not.toHaveBeenCalled();
  });
});
