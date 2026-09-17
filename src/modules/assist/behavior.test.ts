import { describe, expect, it } from "vitest";
import {
  applyAcceptedSuggestion,
  appendTranscription,
  microphoneAccessMessage,
  recordingFileName,
  safeSpeechClientErrorDetails,
} from "./behavior";
import { getWritingProvider } from "@/modules/ai/provider";
import { getSpeechProvider } from "@/modules/speech/provider";

describe("Text- und Spracheingabe", () => {
  it("überschreibt den Originaltext ohne explizite Übernahme nie", () => {
    expect(applyAcceptedSuggestion("Original", "Vorschlag", false)).toBe(
      "Original",
    );
    expect(applyAcceptedSuggestion("Original", "Vorschlag", true)).toBe(
      "Vorschlag",
    );
  });

  it("hängt Transkriptionen an bestehenden Text an", () => {
    expect(appendTranscription("Bestehender Text.", "Neue Spracheingabe.")).toBe(
      "Bestehender Text. Neue Spracheingabe.",
    );
    expect(appendTranscription("", "Neue Spracheingabe.")).toBe(
      "Neue Spracheingabe.",
    );
  });

  it("gibt MediaRecorder-Dateien eine zum normalisierten MIME-Typ passende Endung", () => {
    expect(recordingFileName("audio/webm;codecs=opus")).toBe("aufnahme.webm");
    expect(recordingFileName("audio/ogg;codecs=opus")).toBe("aufnahme.ogg");
    expect(recordingFileName("audio/mp4")).toBe("aufnahme.mp4");
  });

  it("redigiert Geheimnisse aus Transportdiagnosen", () => {
    const fakeSecret = ["sk", "production", "secret"].join("-");
    const details = safeSpeechClientErrorDetails(
      new Error(`Failed with Bearer ${fakeSecret}`),
    );
    expect(JSON.stringify(details)).not.toContain(fakeSecret);
    expect(details.name).toBe("Error");
  });

  it("bleibt ohne konfigurierte Provider verfügbar", () => {
    expect(getWritingProvider({})).toBeNull();
    expect(getSpeechProvider({})).toBeNull();
    expect(microphoneAccessMessage).toContain("manuell eingeben");
  });

  it("stellt Mock-Provider ohne Live-Aufrufe bereit", async () => {
    const provider = getWritingProvider({
      AI_PROVIDER: "mock",
    });
    expect(
      await provider?.formulate({
        notes: "führung prüfen",
        fieldLabel: "Beschreibung",
      }),
    ).toBe("Führung prüfen.");
  });
});
