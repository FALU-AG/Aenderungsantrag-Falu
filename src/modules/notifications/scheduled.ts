import { db } from "@/server/db/client";
import { formatDateZurich } from "@/lib/date-time";
import { STATUS_LABELS } from "@/modules/workflow/status";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/tasks/domain";
import { queueNotification } from "./repository";
import { sendNotifications } from "./service-core";
import { groupDigestTasks, isZurichRunTime, zurichIsoWeekKey, type DigestTask } from "./scheduled-domain";
import { absoluteAppUrl } from "@/lib/app-paths";

const appUrl = (path: string) => absoluteAppUrl(path);

function serializeTask(task: DigestTask) {
  return { title: task.title, number: task.changeRequest.number, requestTitle: task.changeRequest.title, priority: PRIORITY_LABELS[task.priority], dueDate: task.dueDate ? formatDateZurich(task.dueDate) : "Kein Termin", status: TASK_STATUS_LABELS[task.status], url: appUrl(`/change-requests/${task.changeRequest.id}?tab=Aufgaben#task-${task.id}`) };
}

type DigestRequest = { id: string; number: string; title: string; status: keyof typeof STATUS_LABELS; approvalCycle: number; approvals: Array<{ type: "AVOR" | "TECHNICAL"; status: string; cycle: number }> };

function requestStatus(request: DigestRequest) {
  if (request.status !== "UNDER_REVIEW") return STATUS_LABELS[request.status];
  const pending = request.approvals.filter((approval) => approval.cycle === request.approvalCycle && approval.status === "PENDING").map(({ type }) => type);
  if (pending.length === 2) return "Wartet auf AVOR- und technische Freigabe";
  if (pending[0] === "AVOR") return "Wartet auf AVOR-Freigabe";
  if (pending[0] === "TECHNICAL") return "Wartet auf technische Freigabe";
  return STATUS_LABELS[request.status];
}

const serializeRequest = (request: DigestRequest) => ({ number: request.number, title: request.title, status: requestStatus(request), url: appUrl(`/change-requests/${request.id}`) });

export async function runWeeklyDigest(options: { now?: Date; ignoreSchedule?: boolean } = {}) {
  const now = options.now ?? new Date();
  if (!options.ignoreSchedule && !isZurichRunTime(now, true)) return { queued: 0, skippedSchedule: true };
  const [users, pendingApprovals] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: {
      id: true, email: true, name: true,
      roles: { select: { role: { select: { key: true } } } },
      delegationsReceived: { where: { enabled: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }, { id: "asc" }], select: { scope: true, delegatingUser: { select: { name: true, active: true, roles: { select: { role: { select: { key: true } } } } } } } },
      requests: { where: { status: { not: "CLOSED" } }, orderBy: { updatedAt: "desc" }, select: { id: true, number: true, title: true, status: true, approvalCycle: true, approvals: { select: { type: true, status: true, cycle: true } } } },
      assignedTasks: { where: { status: { not: "DONE" } }, orderBy: [{ dueDate: "asc" }, { priority: "desc" }], select: { id: true, title: true, dueDate: true, priority: true, status: true, changeRequest: { select: { id: true, number: true, title: true } } } },
    } }),
    db.approval.findMany({ where: { status: "PENDING", changeRequest: { status: "UNDER_REVIEW" } }, select: { type: true, cycle: true, changeRequest: { select: { id: true, number: true, title: true, approvalCycle: true } } } }),
  ]);
  const ids: string[] = [];
  for (const user of users) {
    const groups = groupDigestTasks(user.assignedTasks, now);
    const explicitRoles = new Set(user.roles.map(({ role }) => role.key));
    const approvals = new Map<string, { number: string; title: string; types: string[]; url: string }>();
    for (const approval of pendingApprovals) {
      const delegatedFor = user.delegationsReceived?.find((delegation) => delegation.scope === `${approval.type}_APPROVAL` && delegation.delegatingUser.active && delegation.delegatingUser.roles.some(({ role }) => role.key === approval.type))?.delegatingUser.name;
      if (approval.cycle !== approval.changeRequest.approvalCycle || (!explicitRoles.has(approval.type) && !delegatedFor)) continue;
      const existing = approvals.get(approval.changeRequest.id) ?? { number: approval.changeRequest.number, title: approval.changeRequest.title, types: [], url: appUrl(`/change-requests/${approval.changeRequest.id}?tab=Freigaben`) };
      existing.types.push(`${approval.type === "AVOR" ? "AVOR" : "Technik"}${!explicitRoles.has(approval.type) && delegatedFor ? ` (Stellvertretung für ${delegatedFor})` : ""}`);
      approvals.set(approval.changeRequest.id, existing);
    }
    const taskCount = groups.overdue.length + groups.dueThisWeek.length + groups.other.length;
    if (taskCount === 0 && user.requests.length === 0 && approvals.size === 0) continue;
    const row = await queueNotification(db, {
      type: "WEEKLY_TASK_DIGEST",
      idempotencyKey: `weekly-digest:${user.id}:${zurichIsoWeekKey(now)}`,
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.name,
      subject: "Meine Wochenübersicht | FALU Change Request",
      templateData: { greetingName: user.name, openCount: taskCount, overdueCount: groups.overdue.length, dueThisWeekCount: groups.dueThisWeek.length, overdue: groups.overdue.map(serializeTask), dueThisWeek: groups.dueThisWeek.map(serializeTask), other: groups.other.map(serializeTask), ownRequests: user.requests.map(serializeRequest), approvals: [...approvals.values()].map((approval) => ({ ...approval, responsibility: `${approval.types.join(" + ")}-Freigabe erforderlich` })), url: appUrl("/meine-aufgaben") },
    });
    ids.push(row.id);
  }
  await sendNotifications(ids);
  return { queued: new Set(ids).size, skippedSchedule: false };
}

export const runWeeklyTaskDigests = runWeeklyDigest;
