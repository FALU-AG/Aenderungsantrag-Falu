import type { ChangeRequestStatusKey } from "./status";

export const WORKFLOW_TABS = [
  "Übersicht",
  "Freigaben",
  "Technische Prüfung",
  "AVOR",
  "Einkauf",
  "Abschlussprüfung",
] as const;

export const ADDITIONAL_TABS = [
  "Aufgaben",
  "Anhänge",
  "Kommentare",
  "Historie",
] as const;

export type WorkflowTab = (typeof WORKFLOW_TABS)[number];
export type AdditionalTab = (typeof ADDITIONAL_TABS)[number];
export type DetailTab = WorkflowTab | AdditionalTab;
export type WorkflowStageState =
  | "COMPLETED"
  | "CURRENT"
  | "NOT_STARTED"
  | "REJECTED"
  | "NOT_REQUIRED";

type Review = { completed: boolean } | null | undefined;

export type WorkflowNavigationSource = {
  status: ChangeRequestStatusKey;
  approvals: Array<{ type: string; status: string }>;
  technicalReview?: Review;
  avorReview?: Review;
  purchasingReview?:
    | { completed: boolean; purchasingRequired?: boolean | null }
    | null;
};

export type WorkflowStage = {
  tab: WorkflowTab;
  state: WorkflowStageState;
};

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStageState, string> = {
  COMPLETED: "Abgeschlossen",
  CURRENT: "Aktuell",
  NOT_STARTED: "Noch nicht gestartet",
  REJECTED: "Überarbeitung erforderlich",
  NOT_REQUIRED: "Nicht erforderlich",
};

const avorStatuses = new Set<ChangeRequestStatusKey>([
  "APPROVED_FOR_IMPLEMENTATION",
  "IMPLEMENTATION",
  "AVOR_PRODUCTION_PREPARATION",
  "PURCHASING_PROCUREMENT",
  "FINAL_REVIEW",
]);

export function deriveWorkflowStages(
  source: WorkflowNavigationSource,
): WorkflowStage[] {
  const approvalsRejected =
    source.status === "CHANGES_REQUESTED" ||
    source.approvals.some(({ status }) => status === "REJECTED");
  const approvalsCompleted =
    source.approvals.some(({ type, status }) =>
      type === "AVOR" && status === "APPROVED",
    ) &&
    source.approvals.some(({ type, status }) =>
      type === "TECHNICAL" && status === "APPROVED",
    );
  const technicalApproved = source.approvals.some(
    ({ type, status }) => type === "TECHNICAL" && status === "APPROVED",
  );

  const overview: WorkflowStageState =
    source.status === "DRAFT" ? "CURRENT" : "COMPLETED";
  const approvals: WorkflowStageState = approvalsRejected
    ? "REJECTED"
    : approvalsCompleted
      ? "COMPLETED"
      : source.status === "UNDER_REVIEW"
        ? "CURRENT"
        : "NOT_STARTED";
  const technical: WorkflowStageState = source.technicalReview?.completed
    ? "COMPLETED"
    : source.technicalReview ||
        (technicalApproved &&
          source.status !== "DRAFT" &&
          source.status !== "CHANGES_REQUESTED" &&
          source.status !== "CLOSED")
      ? "CURRENT"
      : "NOT_STARTED";
  const avor: WorkflowStageState = source.avorReview?.completed
    ? "COMPLETED"
    : source.avorReview || avorStatuses.has(source.status)
      ? "CURRENT"
      : "NOT_STARTED";
  const purchasing: WorkflowStageState =
    source.purchasingReview?.completed &&
    source.purchasingReview.purchasingRequired === false
      ? "NOT_REQUIRED"
      : source.purchasingReview?.completed
        ? "COMPLETED"
        : source.purchasingReview ||
            source.status === "PURCHASING_PROCUREMENT"
          ? "CURRENT"
          : "NOT_STARTED";
  const finalReview: WorkflowStageState =
    source.status === "CLOSED"
      ? "COMPLETED"
      : source.status === "FINAL_REVIEW"
        ? "CURRENT"
        : "NOT_STARTED";

  return [
    { tab: "Übersicht", state: overview },
    { tab: "Freigaben", state: approvals },
    { tab: "Technische Prüfung", state: technical },
    { tab: "AVOR", state: avor },
    { tab: "Einkauf", state: purchasing },
    { tab: "Abschlussprüfung", state: finalReview },
  ];
}
