import type { RoleKey } from "@/modules/auth";
import { isTaskOverdue, type TaskStatusKey } from "@/modules/tasks/domain";

export type InboxKind =
  | "APPROVAL"
  | "REVIEW"
  | "PURCHASING"
  | "FINAL_APPROVAL"
  | "TASK";
export type InboxFilter =
  | "ALL"
  | "APPROVALS"
  | "REVIEWS"
  | "PURCHASING"
  | "FINAL"
  | "TASKS"
  | "OVERDUE";

export type RequestRef = {
  id: string;
  number: string;
  title: string;
  status: string;
  approvalCycle: number;
  finalReviewCycle: number;
  machineTypes: { machineType: { code: string } }[];
  approvals: Array<{
    type: "AVOR" | "TECHNICAL";
    status: "PENDING" | "APPROVED" | "REJECTED";
    cycle: number;
  }>;
  finalApprovals: Array<{ type: "AVOR" | "TECHNICAL"; cycle: number }>;
  technicalReview: { completed: boolean } | null;
  avorImpactReview: { completed: boolean } | null;
  purchasingReview: { completed: boolean } | null;
};
export type TaskRef = {
  id: string;
  title: string;
  status: TaskStatusKey;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  dueDate: Date | null;
  changeRequest: Pick<
    RequestRef,
    "id" | "number" | "title" | "status" | "machineTypes"
  >;
};

export type InboxItem = {
  id: string;
  kind: InboxKind;
  typeLabel: string;
  action: string;
  href: string;
  requestId: string;
  requestNumber: string;
  requestTitle: string;
  machineTypes: string[];
  statusLabel: string;
  dueDate: Date | null;
  priority: TaskRef["priority"] | null;
  overdue: boolean;
};

const activeApproval = (
  request: RequestRef,
  type: "AVOR" | "TECHNICAL",
) =>
  request.approvals.find(
    (approval) =>
      approval.cycle === request.approvalCycle && approval.type === type,
  );
const hasFinalApproval = (
  request: RequestRef,
  type: "AVOR" | "TECHNICAL",
) =>
  request.finalApprovals.some(
    (approval) =>
      approval.cycle === request.finalReviewCycle && approval.type === type,
  );
const workflowItem = (
  request: RequestRef,
  input: Pick<InboxItem, "id" | "kind" | "typeLabel" | "action" | "href">,
): InboxItem => ({
  ...input,
  requestId: request.id,
  requestNumber: request.number,
  requestTitle: request.title,
  machineTypes: request.machineTypes.map(({ machineType }) => machineType.code),
  statusLabel: "Offen",
  dueDate: null,
  priority: null,
  overdue: false,
});

export function buildPersonalInbox({
  roles,
  requests,
  tasks,
  now = new Date(),
}: {
  roles: readonly RoleKey[];
  requests: RequestRef[];
  tasks: TaskRef[];
  now?: Date;
}): InboxItem[] {
  const items: InboxItem[] = [];
  const avor = roles.includes("AVOR");
  const technical = roles.includes("TECHNICAL");

  for (const request of requests) {
    if (request.status === "CLOSED") continue;
    const avorApproval = activeApproval(request, "AVOR");
    const technicalApproval = activeApproval(request, "TECHNICAL");

    if (
      avor &&
      request.status === "UNDER_REVIEW" &&
      avorApproval?.status === "PENDING"
    )
      items.push(
        workflowItem(request, {
          id: `approval:${request.id}:AVOR:${request.approvalCycle}`,
          kind: "APPROVAL",
          typeLabel: "Freigabe",
          action: "AVOR-Freigabe erforderlich",
          href: `/change-requests/${request.id}?tab=Freigaben`,
        }),
      );
    if (
      technical &&
      request.status === "UNDER_REVIEW" &&
      technicalApproval?.status === "PENDING"
    )
      items.push(
        workflowItem(request, {
          id: `approval:${request.id}:TECHNICAL:${request.approvalCycle}`,
          kind: "APPROVAL",
          typeLabel: "Freigabe",
          action: "Technische Freigabe erforderlich",
          href: `/change-requests/${request.id}?tab=Freigaben`,
        }),
      );
    if (
      technical &&
      technicalApproval?.status === "APPROVED" &&
      !request.technicalReview?.completed
    )
      items.push(
        workflowItem(request, {
          id: `review:${request.id}:TECHNICAL`,
          kind: "REVIEW",
          typeLabel: "Prüfung",
          action: "Technische Prüfung durchführen",
          href: `/change-requests/${request.id}?tab=${encodeURIComponent("Technische Prüfung")}`,
        }),
      );
    if (
      avor &&
      [
        "APPROVED_FOR_IMPLEMENTATION",
        "AVOR_PRODUCTION_PREPARATION",
        "PURCHASING_PROCUREMENT",
        "FINAL_REVIEW",
      ].includes(request.status) &&
      !request.avorImpactReview?.completed
    )
      items.push(
        workflowItem(request, {
          id: `review:${request.id}:AVOR`,
          kind: "REVIEW",
          typeLabel: "Prüfung",
          action: "AVOR-Prüfung durchführen",
          href: `/change-requests/${request.id}?tab=AVOR`,
        }),
      );
    if (
      avor &&
      request.status === "PURCHASING_PROCUREMENT" &&
      !request.purchasingReview?.completed
    )
      items.push(
        workflowItem(request, {
          id: `purchasing:${request.id}`,
          kind: "PURCHASING",
          typeLabel: "Einkauf",
          action: "Einkauf / Beschaffung bearbeiten",
          href: `/change-requests/${request.id}?tab=Einkauf`,
        }),
      );
    if (
      avor &&
      request.status === "FINAL_REVIEW" &&
      !hasFinalApproval(request, "AVOR")
    )
      items.push(
        workflowItem(request, {
          id: `final:${request.id}:AVOR:${request.finalReviewCycle}`,
          kind: "FINAL_APPROVAL",
          typeLabel: "Abschluss",
          action: "AVOR-Abschlussfreigabe erforderlich",
          href: `/change-requests/${request.id}?tab=${encodeURIComponent("Abschlussprüfung")}`,
        }),
      );
    if (
      technical &&
      request.status === "FINAL_REVIEW" &&
      !hasFinalApproval(request, "TECHNICAL")
    )
      items.push(
        workflowItem(request, {
          id: `final:${request.id}:TECHNICAL:${request.finalReviewCycle}`,
          kind: "FINAL_APPROVAL",
          typeLabel: "Abschluss",
          action: "Technische Abschlussfreigabe erforderlich",
          href: `/change-requests/${request.id}?tab=${encodeURIComponent("Abschlussprüfung")}`,
        }),
      );
  }

  for (const task of tasks) {
    if (task.status === "DONE" || task.changeRequest.status === "CLOSED") continue;
    items.push({
      id: `task:${task.id}`,
      kind: "TASK",
      typeLabel: "Aufgabe",
      action: task.title,
      href: `/change-requests/${task.changeRequest.id}?tab=Aufgaben#task-${task.id}`,
      requestId: task.changeRequest.id,
      requestNumber: task.changeRequest.number,
      requestTitle: task.changeRequest.title,
      machineTypes: task.changeRequest.machineTypes.map(({ machineType }) => machineType.code),
      statusLabel:
        task.status === "OPEN"
          ? "Offen"
          : task.status === "IN_PROGRESS"
            ? "In Bearbeitung"
            : "Blockiert",
      dueDate: task.dueDate,
      priority: task.priority,
      overdue: isTaskOverdue(task.dueDate, task.status, now),
    });
  }

  return [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      Number(a.kind === "TASK") - Number(b.kind === "TASK") ||
      a.requestNumber.localeCompare(b.requestNumber, "de-CH"),
  );
}

export function filterInbox(items: InboxItem[], filter: InboxFilter) {
  if (filter === "ALL") return items;
  if (filter === "OVERDUE") return items.filter((item) => item.overdue);
  const kinds: Record<Exclude<InboxFilter, "ALL" | "OVERDUE">, InboxKind[]> = {
    APPROVALS: ["APPROVAL"],
    REVIEWS: ["REVIEW"],
    PURCHASING: ["PURCHASING"],
    FINAL: ["FINAL_APPROVAL"],
    TASKS: ["TASK"],
  };
  return items.filter((item) => kinds[filter].includes(item.kind));
}
