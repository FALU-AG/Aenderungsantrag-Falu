import { z } from "zod";
import type { AuthUser } from "@/modules/auth";

const optionalDate = z
  .union([z.literal(""), z.coerce.date()])
  .transform((value) => (value === "" ? null : value));
export const purchasingDraftSchema = z.object({
  purchasingRequired: z.boolean().nullable(),
  supplier: z.string().trim().max(500),
  supplierNotes: z.string().trim().max(8000),
  orderRequired: z.boolean().nullable(),
  orderCompleted: z.boolean(),
  orderNumber: z.string().trim().max(200),
  orderDate: optionalDate,
  expectedDeliveryDate: optionalDate,
  notes: z.string().trim().max(8000),
});
export const purchasingCompletionSchema = purchasingDraftSchema.superRefine(
  (v, ctx) => {
    if (v.purchasingRequired === null)
      ctx.addIssue({
        code: "custom",
        path: ["purchasingRequired"],
        message: "Bitte angeben, ob eine Beschaffung erforderlich ist.",
      });
    if (v.purchasingRequired) {
      if (!v.supplier)
        ctx.addIssue({
          code: "custom",
          path: ["supplier"],
          message: "Bitte einen Lieferanten angeben.",
        });
      if (v.orderRequired === null)
        ctx.addIssue({
          code: "custom",
          path: ["orderRequired"],
          message: "Bitte angeben, ob eine Bestellung erforderlich ist.",
        });
      if (v.orderRequired && !v.orderCompleted)
        ctx.addIssue({
          code: "custom",
          path: ["orderCompleted"],
          message:
            "Die erforderliche Bestellung muss vor dem Abschluss als bestellt markiert sein.",
        });
    }
  },
);
export const reopenPurchasingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Bitte begründen Sie die erneute Öffnung.")
    .max(2000),
});
export function purchasingReviewAvailable(status: string) {
  return status === "PURCHASING_PROCUREMENT" || status === "FINAL_REVIEW";
}
export function canEditPurchasingReview(
  user: Pick<AuthUser, "roles">,
  status: string,
) {
  return (
    purchasingReviewAvailable(status) &&
    (user.roles.includes("AVOR") || user.roles.includes("ADMINISTRATOR"))
  );
}
export function purchasingReviewState(review?: { completed: boolean } | null) {
  return !review
    ? ("NOT_STARTED" as const)
    : review.completed
      ? ("COMPLETED" as const)
      : ("IN_PROGRESS" as const);
}
export function purchasingCompletionMetadata(userId: string, now = new Date()) {
  return { completed: true, completedById: userId, completedAt: now };
}
export function purchasingReopenedMetadata() {
  return { completed: false, completedById: null, completedAt: null };
}
export function isDeliveryOverdue(
  expected: Date | null | undefined,
  orderCompleted: boolean,
  now = new Date(),
) {
  return Boolean(expected && expected < now && !orderCompleted);
}
export function statusAfterPurchasingCompletion(
  status: string,
  completed: boolean,
) {
  return status === "PURCHASING_PROCUREMENT" && completed
    ? "FINAL_REVIEW"
    : status;
}
export function purchasingAudit(
  userName: string,
  event: "STARTED" | "SAVED" | "COMPLETED" | "REOPENED" | "ORDER_PLACED",
  reason?: string,
) {
  const summaries = {
    STARTED: `${userName} hat die Einkaufsprüfung begonnen.`,
    SAVED: `${userName} hat die Einkaufsprüfung aktualisiert.`,
    COMPLETED: `${userName} hat die Einkaufsprüfung abgeschlossen.`,
    REOPENED: `${userName} hat die Einkaufsprüfung erneut geöffnet. Grund: ${reason}`,
    ORDER_PLACED: `${userName} hat die Bestellung als ausgelöst markiert.`,
  };
  return { action: `PURCHASING_REVIEW_${event}`, summary: summaries[event] };
}
