import type { ChangeRequestStatus, TaskPriority, TaskStatus } from "@prisma/client";

export const INACTIVITY_DAYS = 7;
export const RELEVANT_ACTIVITY_ACTIONS = [
  "CHANGE_REQUEST_SUBMITTED",
  "REVISED_REQUEST_SUBMITTED",
  "CHANGE_REQUEST_UPDATED",
  "MACHINE_TYPES_CHANGED",
  "REVISION_STARTED",
  "AVOR_APPROVED",
  "AVOR_REJECTED",
  "TECHNICAL_APPROVED",
  "TECHNICAL_REJECTED",
  "STATUS_TRANSITIONED",
  "TECHNICAL_REVIEW_STARTED",
  "TECHNICAL_REVIEW_SAVED",
  "TECHNICAL_REVIEW_COMPLETED",
  "TECHNICAL_REVIEW_REOPENED",
  "AVOR_REVIEW_STARTED",
  "AVOR_REVIEW_SAVED",
  "AVOR_REVIEW_COMPLETED",
  "AVOR_REVIEW_REOPENED",
  "PURCHASING_REVIEW_STARTED",
  "PURCHASING_REVIEW_SAVED",
  "PURCHASING_REVIEW_COMPLETED",
  "PURCHASING_REVIEW_REOPENED",
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "TASK_STATUS_CHANGED",
  "TASK_COMPLETED",
  "TASK_REOPENED",
  "TASK_CLOSURE_CHANGED",
  "TASK_DELETED",
  "FINAL_REVIEW_CYCLE_STARTED",
  "FINAL_REVIEW_CHANGES_REQUIRED",
  "FINAL_REVIEW_REOPENED",
  "FINAL_REVIEW_APPROVED",
  "FINAL_REVIEW_CLOSED",
  "FINAL_REVIEW_COMMENT_UPDATED",
  "ATTACHMENT_UPLOADED",
  "ATTACHMENT_REMOVED",
] as const;

const DAY_MS = 86_400_000;

export function inactivityPeriod(lastActivityAt: Date, now: Date) {
  return Math.floor((now.getTime() - lastActivityAt.getTime()) / (INACTIVITY_DAYS * DAY_MS));
}

export function inactivityKey(requestId: string, lastActivityAt: Date, period: number) {
  return `inactivity:${requestId}:${lastActivityAt.toISOString()}:${period}`;
}

export function canReceiveInactivityReminder(status: ChangeRequestStatus, submittedAt: Date | null, lastActivityAt: Date, now: Date) {
  return status !== "DRAFT" && status !== "CLOSED" && submittedAt !== null && inactivityPeriod(lastActivityAt, now) >= 1;
}

const zurichParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
);

export function isZurichRunTime(now: Date, mondayOnly = false) {
  const parts = zurichParts(now);
  return parts.hour === "08" && (!mondayOnly || parts.weekday === "Mon");
}

export function zurichDateKey(date: Date) {
  const parts = zurichParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDateDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type DigestTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  changeRequest: { id: string; number: string; title: string };
};

export function groupDigestTasks(tasks: DigestTask[], now: Date) {
  const today = zurichDateKey(now);
  const nextMonday = addDateDays(today, 7);
  const groups = { overdue: [] as DigestTask[], dueThisWeek: [] as DigestTask[], other: [] as DigestTask[] };
  for (const task of tasks.filter(({ status }) => status !== "DONE")) {
    const due = task.dueDate ? zurichDateKey(task.dueDate) : null;
    if (due && due < today) groups.overdue.push(task);
    else if (due && due < nextMonday) groups.dueThisWeek.push(task);
    else groups.other.push(task);
  }
  return groups;
}
