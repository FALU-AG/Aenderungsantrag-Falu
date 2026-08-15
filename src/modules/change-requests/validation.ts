import { z } from "zod";

const baseSchema = z.object({
  title: z.string().trim().max(200, "Der Titel darf höchstens 200 Zeichen enthalten."),
  machineTypeId: z.string().trim(),
  articleNumber: z.string().trim().max(100, "Die Nummer darf höchstens 100 Zeichen enthalten."),
  articleDescription: z.string().trim().max(300, "Die Bezeichnung darf höchstens 300 Zeichen enthalten."),
  reasonIds: z.array(z.string()),
  otherReasonText: z.string().trim().max(500, "Der sonstige Grund darf höchstens 500 Zeichen enthalten."),
  description: z.string().trim().max(10_000, "Die Beschreibung darf höchstens 10'000 Zeichen enthalten."),
  version: z.coerce.number().int().positive().optional(),
});

export const draftSchema = baseSchema;

export function submissionSchema(otherReasonId?: string) {
  return baseSchema.superRefine((data, ctx) => {
    if (!data.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Titel ist erforderlich." });
    if (!data.machineTypeId) ctx.addIssue({ code: "custom", path: ["machineTypeId"], message: "Maschinentyp ist erforderlich." });
    if (data.reasonIds.length === 0) ctx.addIssue({ code: "custom", path: ["reasonIds"], message: "Wählen Sie mindestens einen Änderungsgrund." });
    if (!data.description) ctx.addIssue({ code: "custom", path: ["description"], message: "Beschreibung und Begründung sind erforderlich." });
    if (otherReasonId && data.reasonIds.includes(otherReasonId) && !data.otherReasonText) ctx.addIssue({ code: "custom", path: ["otherReasonText"], message: "Geben Sie den sonstigen Änderungsgrund an." });
  });
}

export type ChangeRequestInput = z.infer<typeof draftSchema>;

export function formDataToInput(formData: FormData): ChangeRequestInput {
  return {
    title: String(formData.get("title") ?? ""), machineTypeId: String(formData.get("machineTypeId") ?? ""),
    articleNumber: String(formData.get("articleNumber") ?? ""), articleDescription: String(formData.get("articleDescription") ?? ""),
    reasonIds: formData.getAll("reasonIds").map(String), otherReasonText: String(formData.get("otherReasonText") ?? ""),
    description: String(formData.get("description") ?? ""), version: formData.get("version") ? Number(formData.get("version")) : undefined,
  };
}
