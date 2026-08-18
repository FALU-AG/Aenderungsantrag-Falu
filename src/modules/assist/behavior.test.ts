import { describe, expect, it } from "vitest";
import { applyAcceptedSuggestion, microphoneAccessMessage } from "./behavior";
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
