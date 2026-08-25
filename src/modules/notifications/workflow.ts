import type { Prisma } from "@prisma/client";
import { activeRoleRecipients, requestRecipient } from "./recipients";
import { queueNotification } from "./repository";

const baseUrl = () => {
  const value = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return new URL(value).origin;
};

async function requestSummary(tx: Prisma.TransactionClient, id: string) {
  return tx.changeRequest.findUniqueOrThrow({ where: { id }, select: { id: true, number: true, title: true, applicantName: true, approvalCycle: true, finalReviewCycle: true, machineTypes: { select: { machineType: { select: { code: true } } }, orderBy: { machineType: { code: "asc" } } } } });
}

export async function queueApprovalCycleNotifications(tx: Prisma.TransactionClient, requestId: string, cycle: number) {
  const request = await requestSummary(tx, requestId);
  const ids: string[] = [];
  for (const type of ["AVOR", "TECHNICAL"] as const) for (const recipient of await activeRoleRecipients(tx, type)) {
    const row = await queueNotification(tx, { type: type === "AVOR" ? "APPROVAL_REQUIRED_AVOR" : "APPROVAL_REQUIRED_TECHNICAL", idempotencyKey: `approval:${requestId}:${cycle}:${type}:${recipient.id}`, recipientUserId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name, changeRequestId: requestId, subject: `${type === "AVOR" ? "Freigabe erforderlich" : "Technische Freigabe erforderlich"} | ${request.number}`, templateData: { number: request.number, title: request.title, machineTypes: request.machineTypes.map(({ machineType }) => machineType.code).join(", "), applicantName: request.applicantName, url: `${baseUrl()}/change-requests/${requestId}?tab=Freigaben` } });
    ids.push(row.id);
  }
  return ids;
}

export async function queueRequestNotification(tx: Prisma.TransactionClient, requestId: string, type: "REQUEST_CHANGES_REQUIRED" | "REQUEST_APPROVED" | "REQUEST_CLOSED", key: string, detail?: string) {
  const [request, recipient] = await Promise.all([requestSummary(tx, requestId), requestRecipient(tx, requestId)]);
  if (!recipient) return [];
  const subjects = { REQUEST_CHANGES_REQUIRED: "Änderung erforderlich", REQUEST_APPROVED: "Antrag freigegeben", REQUEST_CLOSED: "Änderungsantrag abgeschlossen" };
  const row = await queueNotification(tx, { type, idempotencyKey: `${key}:${recipient.id}`, recipientUserId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name, changeRequestId: requestId, subject: `${subjects[type]} | ${request.number}`, templateData: { number: request.number, title: request.title, machineTypes: request.machineTypes.map(({ machineType }) => machineType.code).join(", "), applicantName: request.applicantName, detail, url: `${baseUrl()}/change-requests/${requestId}` } });
  return [row.id];
}

export async function queueTaskAssignmentNotification(tx: Prisma.TransactionClient, taskId: string, eventKey: string) {
  const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, select: { id: true, title: true, priority: true, dueDate: true, responsibleUser: { select: { id: true, email: true, name: true, active: true } }, changeRequest: { select: { id: true, number: true, title: true } } } });
  if (!task.responsibleUser?.active) return [];
  const row = await queueNotification(tx, { type: "TASK_ASSIGNED", idempotencyKey: `task:${task.id}:${eventKey}:${task.responsibleUser.id}`, recipientUserId: task.responsibleUser.id, recipientEmail: task.responsibleUser.email, recipientName: task.responsibleUser.name, changeRequestId: task.changeRequest.id, taskId: task.id, subject: `Neue Aufgabe | ${task.changeRequest.number}`, templateData: { number: task.changeRequest.number, title: task.title, detail: `Priorität: ${task.priority}${task.dueDate ? `, fällig: ${task.dueDate.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}` : ""}`, url: `${baseUrl()}/change-requests/${task.changeRequest.id}?tab=Aufgaben#task-${task.id}` } });
  return [row.id];
}
