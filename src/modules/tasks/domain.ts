import { z } from "zod";
import type { AuthUser } from "@/modules/auth";

export const TASK_DEPARTMENTS = [
  "TECHNICAL",
  "AVOR",
  "PURCHASING",
  "PRODUCTION_ASSEMBLY",
  "AUTOMATION_SOFTWARE",
  "SERVICE",
  "SALES",
  "OTHER",
] as const;
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export const TASK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
] as const;
export type TaskStatusKey = (typeof TASK_STATUSES)[number];
export const DEPARTMENT_LABELS: Record<
  (typeof TASK_DEPARTMENTS)[number],
  string
> = {
  TECHNICAL: "Technik",
  AVOR: "AVOR",
  PURCHASING: "Einkauf",
  PRODUCTION_ASSEMBLY: "Produktion / Montage",
  AUTOMATION_SOFTWARE: "Automation / Software",
  SERVICE: "Service",
  SALES: "Verkauf",
  OTHER: "Sonstiges",
};
export const PRIORITY_LABELS: Record<(typeof TASK_PRIORITIES)[number], string> =
  { LOW: "Niedrig", NORMAL: "Normal", HIGH: "Hoch", CRITICAL: "Kritisch" };
export const TASK_STATUS_LABELS: Record<TaskStatusKey, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  BLOCKED: "Blockiert",
  DONE: "Erledigt",
};
const optionalDate = z
  .union([z.literal(""), z.coerce.date()])
  .transform((v) => (v === "" ? null : v));
export const taskSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(500),
  description: z.string().trim().max(8000),
  responsibleUserId: z
    .string()
    .trim()
    .min(1, "Bitte eine verantwortliche Person auswählen."),
  department: z.enum(TASK_DEPARTMENTS, {
    message: "Bitte eine Abteilung auswählen.",
  }),
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  requiredForClosure: z.boolean(),
});
export type TaskPermissionRecord = {
  createdById: string;
  responsibleUserId: string | null;
  status: TaskStatusKey;
};
const admin = (u: Pick<AuthUser, "roles">) => u.roles.includes("ADMINISTRATOR");
export function canCreateAndAssignTasks(user: Pick<AuthUser, "roles">) {
  return user.roles.some((role) =>
    (["AVOR", "TECHNICAL", "ADMINISTRATOR"] as const).includes(
      role as "AVOR" | "TECHNICAL" | "ADMINISTRATOR",
    ),
  );
}
export function taskWorkAvailable(requestStatus: string) {
  return requestStatus !== "CLOSED";
}
export function taskAccess(
  user: Pick<AuthUser, "id" | "roles">,
  task: TaskPermissionRecord,
) {
  return {
    full:
      admin(user) ||
      (task.createdById === user.id && canCreateAndAssignTasks(user)),
    responsible: task.responsibleUserId === user.id,
    canComplete:
      admin(user) ||
      task.createdById === user.id ||
      task.responsibleUserId === user.id,
    canDelete:
      (admin(user) || task.createdById === user.id) && task.status === "OPEN",
  };
}
export function completionMetadata(
  previous: TaskStatusKey,
  next: TaskStatusKey,
  userId: string,
  now = new Date(),
) {
  if (next === "DONE" && previous !== "DONE")
    return { completedById: userId, completedAt: now };
  if (previous === "DONE" && next !== "DONE")
    return { completedById: null, completedAt: null };
  return {};
}
export function isTaskOverdue(
  dueDate: Date | null | undefined,
  status: TaskStatusKey,
  now = new Date(),
) {
  if (!dueDate || status === "DONE") return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
export function sortTasks<
  T extends { status: TaskStatusKey; dueDate: Date | null },
>(tasks: T[]) {
  return [...tasks].sort(
    (a, b) =>
      Number(a.status === "DONE") - Number(b.status === "DONE") ||
      Number(!a.dueDate) - Number(!b.dueDate) ||
      (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
  );
}
export function taskSummary(
  tasks: Array<{
    status: TaskStatusKey;
    dueDate: Date | null;
    requiredForClosure: boolean;
  }>,
  now = new Date(),
) {
  return {
    open: tasks.filter((t) => t.status !== "DONE").length,
    overdue: tasks.filter((t) => isTaskOverdue(t.dueDate, t.status, now))
      .length,
    blocked: tasks.filter((t) => t.status === "BLOCKED").length,
    requiredOpen: tasks.filter(
      (t) => t.requiredForClosure && t.status !== "DONE",
    ).length,
  };
}
export function assignedTaskWhere(userId: string) {
  return { responsibleUserId: userId };
}
export function overdueTaskWhere(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return { dueDate: { lt: today }, status: { not: "DONE" as const } };
}
export function taskAudit(
  event:
    | "CREATED"
    | "UPDATED"
    | "ASSIGNED"
    | "STATUS_CHANGED"
    | "COMPLETED"
    | "REOPENED"
    | "CLOSURE_CHANGED"
    | "DELETED",
  actor: string,
  title: string,
  detail?: string,
) {
  const summaries = {
    CREATED: `${actor} hat die Aufgabe „${title}“ erstellt.`,
    UPDATED: `${actor} hat die Aufgabe „${title}“ aktualisiert.`,
    ASSIGNED: `Die Aufgabe „${title}“ wurde ${detail} zugewiesen.`,
    STATUS_CHANGED: `${actor} hat den Status der Aufgabe „${title}“ auf ${detail} gesetzt.`,
    COMPLETED: `${actor} hat die Aufgabe „${title}“ als erledigt markiert.`,
    REOPENED: `${actor} hat die erledigte Aufgabe „${title}“ erneut geöffnet.`,
    CLOSURE_CHANGED: `${actor} hat die Abschlussrelevanz der Aufgabe „${title}“ geändert.`,
    DELETED: `${actor} hat die offene Aufgabe „${title}“ gelöscht.`,
  };
  return { action: `TASK_${event}`, summary: summaries[event] };
}
