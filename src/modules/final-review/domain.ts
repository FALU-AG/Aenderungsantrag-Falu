import { z } from "zod";
import type { AuthUser } from "@/modules/auth";
export type FinalApprovalType = "AVOR" | "TECHNICAL";
export const FINAL_TYPE_LABELS: Record<FinalApprovalType, string> = {
  AVOR: "AVOR",
  TECHNICAL: "Technik",
};
export const finalApprovalSchema = z.object({
  comment: z.string().trim().max(8000),
});
export const finalCommentSchema = z.object({
  finalComment: z.string().trim().max(12000),
});
export const reasonSchema = z.object({
  reason: z.string().trim().min(1, "Bitte geben Sie einen Grund an.").max(8000),
});
export function canFinalApprove(
  user: Pick<AuthUser, "roles">,
  type: FinalApprovalType,
) {
  return (
    user.roles.includes("ADMINISTRATOR") ||
    user.roles.includes(type === "AVOR" ? "AVOR" : "TECHNICAL")
  );
}
export function canRequestFinalChanges(user: Pick<AuthUser, "roles">) {
  return user.roles.some(
    (role) =>
      role === "AVOR" || role === "TECHNICAL" || role === "ADMINISTRATOR",
  );
}
export function canReopenClosed(user: Pick<AuthUser, "roles">) {
  return user.roles.includes("ADMINISTRATOR");
}
export type ClosureState = {
  technicalCompleted: boolean;
  avorCompleted: boolean;
  purchasingCompleted: boolean;
  blockingTasks: number;
};
export function closurePrerequisites(input: ClosureState) {
  return [
    {
      key: "technical",
      label: "Technische Prüfung abgeschlossen",
      satisfied: input.technicalCompleted,
    },
    {
      key: "avor",
      label: "AVOR-Prüfung abgeschlossen",
      satisfied: input.avorCompleted,
    },
    {
      key: "purchasing",
      label: "Einkauf abgeschlossen",
      satisfied: input.purchasingCompleted,
    },
    {
      key: "tasks",
      label: "Keine offenen abschlussrelevanten Aufgaben",
      satisfied: input.blockingTasks === 0,
    },
  ];
}
export function canClose(input: ClosureState, types: FinalApprovalType[]) {
  return (
    closurePrerequisites(input).every((item) => item.satisfied) &&
    types.includes("AVOR") &&
    types.includes("TECHNICAL")
  );
}
export function nextFinalReviewCycle(current: number) {
  return current + 1;
}
export function blockingClosureTaskCount(
  tasks: Array<{ requiredForClosure: boolean; status: string }>,
) {
  return tasks.filter(
    (task) => task.requiredForClosure && task.status !== "DONE",
  ).length;
}
export function closedMetadata(userId: string, now = new Date()) {
  return { status: "CLOSED" as const, closedAt: now, closedById: userId };
}
export function isClosedReadOnly(status: string) {
  return status === "CLOSED";
}
export function shouldCloseOnce(status: string, ready: boolean) {
  return status === "FINAL_REVIEW" && ready;
}
export function finalAudit(
  event:
    | "APPROVED"
    | "CHANGES_REQUIRED"
    | "CYCLE_STARTED"
    | "CLOSED"
    | "REOPENED"
    | "COMMENT_UPDATED",
  actor: string,
  type?: FinalApprovalType,
  reason?: string,
) {
  const summaries = {
    APPROVED:
      type === "AVOR"
        ? `${actor} hat die Abschlussfreigabe für AVOR erteilt.`
        : `${actor} hat die technische Abschlussfreigabe erteilt.`,
    CHANGES_REQUIRED: `${actor} hat weitere Änderungen angefordert. Grund: ${reason}`,
    CYCLE_STARTED: `Eine neue Abschlussprüfung wurde gestartet.`,
    CLOSED: `Der Änderungsantrag wurde abgeschlossen.`,
    REOPENED: `${actor} hat den abgeschlossenen Änderungsantrag erneut geöffnet. Grund: ${reason}`,
    COMMENT_UPDATED: `${actor} hat die Abschlussbemerkung aktualisiert.`,
  };
  return { action: `FINAL_REVIEW_${event}`, summary: summaries[event] };
}
