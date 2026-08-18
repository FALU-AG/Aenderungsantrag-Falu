import OpenAI from "openai";

export type WritingRequest = {
  notes: string;
  fieldLabel: string;
  context?: string;
};

export interface WritingProvider {
  formulate(request: WritingRequest): Promise<string>;
}

class MockWritingProvider implements WritingProvider {
  async formulate({ notes }: WritingRequest) {
    const text = notes.trim();
    if (!text) return "";
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? "" : "."}`;
  }
}

type ResponsesClient = Pick<OpenAI, "responses">;

export class OpenAIWritingProvider implements WritingProvider {
  constructor(
    private readonly client: ResponsesClient,
    private readonly model = "gpt-5.6",
  ) {}

  async formulate({ notes, fieldLabel, context }: WritingRequest) {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: WRITING_INSTRUCTIONS,
      input: [
        `Feld: ${fieldLabel}`,
        context ? `Kontext: ${context}` : "",
        `Notizen des Benutzers: ${notes}`,
        "Gib ausschließlich den umformulierten Text zurück.",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    return response.output_text.trim();
  }
}

export function getWritingProvider(
  env: Partial<Record<string, string | undefined>> = process.env,
  client?: ResponsesClient,
): WritingProvider | null {
  if (env.AI_PROVIDER === "mock") return new MockWritingProvider();
  if (env.AI_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) return null;
    return new OpenAIWritingProvider(
      client ?? new OpenAI({ apiKey: env.OPENAI_API_KEY }),
      env.OPENAI_TEXT_MODEL || "gpt-5.6",
    );
  }
  return null;
}

export const WRITING_INSTRUCTIONS = [
  "Schreibe einen klaren, knappen und professionellen deutschen Text für einen internen industriellen Änderungsantrag.",
  "Bewahre sämtliche Fakten und bestehende Unsicherheiten.",
  "Erfinde keine technischen Fakten, Artikelnummern, Maschinentypen oder Entscheidungen.",
  "Erfinde insbesondere keine Freigabeentscheidungen.",
  "Verbessere Grammatik, Klarheit und Struktur mit präziser technischer Wortwahl.",
  "Vermeide Marketingsprache.",
].join(" ");
