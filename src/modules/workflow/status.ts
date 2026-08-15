export const CHANGE_REQUEST_STATUSES = [
  "DRAFT", "UNDER_REVIEW", "CHANGES_REQUESTED", "APPROVED_FOR_IMPLEMENTATION", "IMPLEMENTATION",
  "AVOR_PRODUCTION_PREPARATION", "PURCHASING_PROCUREMENT", "FINAL_REVIEW", "CLOSED",
] as const;
export type ChangeRequestStatusKey = (typeof CHANGE_REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<ChangeRequestStatusKey, string> = {
  DRAFT: "Entwurf",
  UNDER_REVIEW: "In Prüfung",
  CHANGES_REQUESTED: "Änderung erforderlich",
  APPROVED_FOR_IMPLEMENTATION: "Zur Umsetzung freigegeben",
  IMPLEMENTATION: "In Umsetzung",
  AVOR_PRODUCTION_PREPARATION: "AVOR / Produktionsvorbereitung",
  PURCHASING_PROCUREMENT: "Einkauf / Beschaffung",
  FINAL_REVIEW: "Abschlussprüfung",
  CLOSED: "Abgeschlossen",
};
