import "server-only";
import { db } from "@/server/db/client";
import { formatDateZurich } from "@/lib/date-time";
import { STATUS_LABELS } from "@/modules/workflow/status";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/tasks/domain";
import { queueNotification } from "./repository";
import { requestRecipient } from "./recipients";
import { sendNotifications } from "./service";
import { canReceiveInactivityReminder, groupDigestTasks, inactivityKey, inactivityPeriod, isZurichRunTime, RELEVANT_ACTIVITY_ACTIONS, zurichDateKey, type DigestTask } from "./scheduled-domain";

const baseUrl = () => new URL(process.env.APP_BASE_URL ?? "http://localhost:3000").origin;

export async function runInactivityReminders(options: { now?: Date; ignoreSchedule?: boolean } = {}) {
  const now = options.now ?? new Date();
  if (!options.ignoreSchedule && !isZurichRunTime(now)) return { queued: 0, skippedSchedule: true };
  const requests = await db.changeRequest.findMany({
    where: { submittedAt: { not: null }, status: { notIn: ["DRAFT", "CLOSED"] } },
    select: { id: true, number: true, title: true, status: true, submittedAt: true, auditEvents: { where: { action: { in: [...RELEVANT_ACTIVITY_ACTIONS] } }, orderBy: { timestamp: "desc" }, take: 1, select: { timestamp: true } } },
  });
  const ids: string[] = [];
  for (const request of requests) {
    const lastActivityAt = request.auditEvents[0]?.timestamp ?? request.submittedAt!;
    if (!canReceiveInactivityReminder(request.status, request.submittedAt, lastActivityAt, now)) continue;
    const recipient = await requestRecipient(db, request.id);
    if (!recipient) continue;
    const period = inactivityPeriod(lastActivityAt, now);
    const row = await queueNotification(db, {
      type: "REQUEST_INACTIVITY_REMINDER",
      idempotencyKey: inactivityKey(request.id, lastActivityAt, period),
      recipientUserId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      changeRequestId: request.id,
      subject: `Keine Aktivität seit 7 Tagen | ${request.number}`,
      templateData: { number: request.number, title: request.title, status: STATUS_LABELS[request.status], phase: STATUS_LABELS[request.status], lastActivity: formatDateZurich(lastActivityAt), url: `${baseUrl()}/change-requests/${request.id}` },
    });
    ids.push(row.id);
  }
  await sendNotifications(ids);
  return { queued: new Set(ids).size, skippedSchedule: false };
}

function serializeTask(task: DigestTask) {
  return { title: task.title, number: task.changeRequest.number, requestTitle: task.changeRequest.title, priority: PRIORITY_LABELS[task.priority], dueDate: task.dueDate ? formatDateZurich(task.dueDate) : "Kein Termin", status: TASK_STATUS_LABELS[task.status], url: `${baseUrl()}/change-requests/${task.changeRequest.id}?tab=Aufgaben#task-${task.id}` };
}

export async function runWeeklyTaskDigests(options: { now?: Date; ignoreSchedule?: boolean } = {}) {
  const now = options.now ?? new Date();
  if (!options.ignoreSchedule && !isZurichRunTime(now, true)) return { queued: 0, skippedSchedule: true };
  const users = await db.user.findMany({
    where: { active: true, assignedTasks: { some: { status: { not: "DONE" } } } },
    select: { id: true, email: true, name: true, assignedTasks: { where: { status: { not: "DONE" } }, orderBy: [{ dueDate: "asc" }, { priority: "desc" }], select: { id: true, title: true, dueDate: true, priority: true, status: true, changeRequest: { select: { id: true, number: true, title: true } } } } },
  });
  const ids: string[] = [];
  for (const user of users) {
    const groups = groupDigestTasks(user.assignedTasks, now);
    const row = await queueNotification(db, {
      type: "WEEKLY_TASK_DIGEST",
      idempotencyKey: `weekly-tasks:${user.id}:${zurichDateKey(now)}`,
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      subject: "Meine offenen Aufgaben | FALU Change Request",
      templateData: { openCount: user.assignedTasks.length, overdueCount: groups.overdue.length, dueThisWeekCount: groups.dueThisWeek.length, overdue: groups.overdue.map(serializeTask), dueThisWeek: groups.dueThisWeek.map(serializeTask), other: groups.other.map(serializeTask), url: `${baseUrl()}/meine-aufgaben` },
    });
    ids.push(row.id);
  }
  await sendNotifications(ids);
  return { queued: new Set(ids).size, skippedSchedule: false };
}
