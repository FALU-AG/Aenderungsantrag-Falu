import { z } from "zod";

const baseSchema = z.object({
  applicantName: z
    .string()
    .trim()
    .max(200, "Der Antragsteller darf höchstens 200 Zeichen enthalten."),
  title: z
    .string()
    .trim()
    .max(200, "Der Titel darf höchstens 200 Zeichen enthalten."),
  machineTypeIds: z.array(z.string().trim().min(1)),
  articleNumber: z
    .string()
    .trim()
    .max(100, "Die Nummer darf höchstens 100 Zeichen enthalten."),
  articleDescription: z
    .string()
    .trim()
    .max(300, "Die Bezeichnung darf höchstens 300 Zeichen enthalten."),
  reasonIds: z.array(z.string()),
  otherReasonText: z
    .string()
    .trim()
    .max(500, "Der sonstige Grund darf höchstens 500 Zeichen enthalten."),
  description: z
    .string()
    .trim()
    .max(10_000, "Die Beschreibung darf höchstens 10'000 Zeichen enthalten."),
  version: z.coerce.number().int().positive().optional(),
});

export const draftSchema = baseSchema;

export function submissionSchema(
  otherReasonId?: string,
  allowedReasonIds?: ReadonlySet<string>,
  allowedMachineTypeIds?: ReadonlySet<string>,
) {
  return baseSchema.superRefine((data, ctx) => {
    if (!data.applicantName)
      ctx.addIssue({
        code: "custom",
        path: ["applicantName"],
        message: "Bitte einen Antragsteller eingeben.",
      });
    if (!data.title)
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Titel ist erforderlich.",
      });
    if (data.machineTypeIds.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["machineTypeIds"],
        message: "Wählen Sie mindestens einen Maschinentyp.",
      });
    if (allowedMachineTypeIds && data.machineTypeIds.some((id) => !allowedMachineTypeIds.has(id)))
      ctx.addIssue({
        code: "custom",
        path: ["machineTypeIds"],
        message: "Ein ausgewählter Maschinentyp ist nicht aktiv oder unbekannt.",
      });
    if (!data.articleNumber)
      ctx.addIssue({
        code: "custom",
        path: ["articleNumber"],
        message: "Bitte eine Artikel- oder Baugruppennummer eingeben.",
      });
    if (!data.articleDescription)
      ctx.addIssue({
        code: "custom",
        path: ["articleDescription"],
        message: "Bitte eine Artikel- oder Baugruppenbezeichnung eingeben.",
      });
    if (data.reasonIds.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["reasonIds"],
        message: "Wählen Sie mindestens einen Änderungsgrund.",
      });
    if (!data.description)
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Beschreibung und Begründung sind erforderlich.",
      });
    if (
      otherReasonId &&
      data.reasonIds.includes(otherReasonId) &&
      !data.otherReasonText
    )
      ctx.addIssue({
        code: "custom",
        path: ["otherReasonText"],
        message: "Geben Sie den sonstigen Änderungsgrund an.",
      });
    if (
      allowedReasonIds &&
      data.reasonIds.some((id) => !allowedReasonIds.has(id))
    )
      ctx.addIssue({
        code: "custom",
        path: ["reasonIds"],
        message: "Ein ausgewählter Änderungsgrund ist nicht mehr aktiv.",
      });
  });
}

export type ChangeRequestInput = z.infer<typeof draftSchema>;

export function creatorAndApplicant(
  authenticatedUserId: string,
  applicantName: string,
) {
  return {
    // applicantId is the immutable authenticated creator relation; applicantName is editable business data.
    applicantId: authenticatedUserId,
    applicantName: applicantName.trim(),
  };
}

export function editableApplicant(applicantName: string) {
  return { applicantName: applicantName.trim() };
}

export function formDataToInput(formData: FormData): ChangeRequestInput {
  return {
    applicantName: String(formData.get("applicantName") ?? ""),
    title: String(formData.get("title") ?? ""),
    machineTypeIds: [...new Set(formData.getAll("machineTypeIds").map(String).filter(Boolean))],
    articleNumber: String(formData.get("articleNumber") ?? ""),
    articleDescription: String(formData.get("articleDescription") ?? ""),
    reasonIds: formData.getAll("reasonIds").map(String),
    otherReasonText: String(formData.get("otherReasonText") ?? ""),
    description: String(formData.get("description") ?? ""),
    version: formData.get("version")
      ? Number(formData.get("version"))
      : undefined,
  };
}
