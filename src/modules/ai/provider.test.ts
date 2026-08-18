import { describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";
import { getWritingProvider, OpenAIWritingProvider } from "./provider";

describe("OpenAI-Schreibprovider", () => {
  it("wählt OpenAI mit konfigurierbarem Responses-Modell", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ output_text: "Professioneller Text." });
    const client = { responses: { create } } as unknown as Pick<
      OpenAI,
      "responses"
    >;
    const provider = getWritingProvider(
      {
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_TEXT_MODEL: "test-model",
      },
      client,
    );
    await expect(
      provider?.formulate({ notes: "rohtext", fieldLabel: "Titel" }),
    ).resolves.toBe("Professioneller Text.");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        input: expect.stringContaining("Feld: Titel"),
      }),
    );
  });

  it("verwendet standardmäßig gpt-5.6", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: "Text" });
    const provider = new OpenAIWritingProvider({
      responses: { create },
    } as unknown as Pick<OpenAI, "responses">);
    await provider.formulate({ notes: "Notiz", fieldLabel: "Beschreibung" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-5.6" }),
    );
  });

  it("bleibt ohne API-Schlüssel sicher unkonfiguriert", () => {
    expect(getWritingProvider({ AI_PROVIDER: "openai" })).toBeNull();
  });

  it("behält den Mock-Provider bei", async () => {
    await expect(
      getWritingProvider({ AI_PROVIDER: "mock" })?.formulate({
        notes: "führung prüfen",
        fieldLabel: "Titel",
      }),
    ).resolves.toBe("Führung prüfen.");
  });
});
