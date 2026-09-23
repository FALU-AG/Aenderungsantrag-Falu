import { centralUsers, centralUser } from "@/modules/auth/directory";
import type { Prisma } from "@prisma/client";
import { activeRoleRecipients, requestRecipient } from "./recipients";
import { queueNotification } from "./repository";
import { absoluteAppUrl } from "@/lib/app-paths";
import { STATUS_LABELS } from "@/modules/workflow/status";

const appUrl = (path: string) => absoluteAppUrl(path);

async function requestSummary(tx: Prisma.TransactionClient, id: string) {
  return tx.changeRequest.findUniqueOrThrow({ where: { id }, select: { id: true, number: true, title: true, description: true, status: true, applicantName: true, approvalCycle: true, finalReviewCycle: true, finalComment: true, closedAt: true, machineTypes: { select: { machineType: { select: { code: true } } }, orderBy: { machineType: { code: "asc" } } } } });
}

export async function queueCompletedRequestBroadcast(tx: Prisma.TransactionClient, requestId: string) {
  const request = await requestSummary(tx, requestId);
  if (request.status !== "CLOSED" || !request.closedAt || !request.finalComment?.trim()) return [];
  const users = await centralUsers(tx);
  const ids: string[] = [];
  for (const recipient of users) {
    const row = await queueNotification(tx, {
      type: "REQUEST_CLOSED",
      idempotencyKey: `completed-broadcast:${requestId}:${recipient.id}`,
      recipientUserId: recipient.id,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      changeRequestId: requestId,
      subject: `Änderungsantrag abgeschlossen | ${request.number}`,
      templateData: {
        number: request.number,
        title: request.title,
        applicantName: request.applicantName,
        machineTypes: request.machineTypes.map(({ machineType }) => machineType.code).join(", "),
        detail: request.description,
        completionSummary: request.finalComment,
        completedAt: request.closedAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }),
        status: STATUS_LABELS[request.status],
        url: appUrl(`/change-requests/${requestId}`),
      },
    });
    ids.push(row.id);
  }
  return ids;
}

export async function queueApprovalCycleNotifications(tx: Prisma.TransactionClient, requestId: string, cycle: number) {
  const request = await requestSummary(tx, requestId);
  const ids: string[] = [];
  const now = new Date();
  // Muss die laufende Transaktion benutzen. Mit dem globalen Client verlangt diese Zeile
  // eine zweite Verbindung aus demselben Pool, waehrend die Transaktion bereits eine haelt:
  // Bei mehreren gleichzeitigen Einreichungen wartet sie auf eine Verbindung, die erst nach
  // ihrem eigenen Ende frei wird, und laeuft nach 5 s in P2028.
  const directory = await centralUsers(tx);
  for (const type of ["AVOR", "TECHNICAL"] as const) {
    const [directRecipients, delegations] = await Promise.all([
      activeRoleRecipients(tx, type),
      tx.approvalDelegation.findMany({ where: { scope: type === "AVOR" ? "AVOR_APPROVAL" : "TECHNICAL_APPROVAL", enabled: true, startsAt: { lte: now }, endsAt: { gte: now }, substituteUserId: { in: directory.map((u)=>u.id) }, delegatingUserId: { in: directory.filter((u)=>u.roles.some(({role})=>role.key===type)).map((u)=>u.id) } }, select: { substituteUser: { select: { id: true, email: true, name: true } }, delegatingUser: { select: { name: true } } } }),
    ]);
    const recipients = new Map(directRecipients.map((recipient) => [recipient.id, { ...recipient, delegatedFor: null as string | null }]));
    for (const delegation of delegations) if (!recipients.has(delegation.substituteUser.id)) recipients.set(delegation.substituteUser.id, { ...directory.find((u)=>u.id===delegation.substituteUser.id)!, delegatedFor: delegation.delegatingUser.name });
    for (const recipient of recipients.values()) {
    const baseDetail = type === "AVOR" ? "Bitte AVOR-Freigabe prüfen." : "Bitte technische Freigabe prüfen.";
    const row = await queueNotification(tx, { type: type === "AVOR" ? "APPROVAL_REQUIRED_AVOR" : "APPROVAL_REQUIRED_TECHNICAL", idempotencyKey: `approval:${requestId}:${cycle}:${type}:${recipient.id}`, recipientUserId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name, changeRequestId: requestId, subject: `${type === "AVOR" ? "Freigabe erforderlich" : "Technische Freigabe erforderlich"} | ${request.number}`, templateData: { number: request.number, title: request.title, machineTypes: request.machineTypes.map(({ machineType }) => machineType.code).join(", "), applicantName: request.applicantName, status: STATUS_LABELS[request.status], detail: `${baseDetail}${recipient.delegatedFor ? ` Stellvertretung für ${recipient.delegatedFor}.` : ""}`, url: appUrl(`/change-requests/${requestId}?tab=Freigaben`) } });
    ids.push(row.id);
    }
  }
  return ids;
}

export async function queueRequestNotification(tx: Prisma.TransactionClient, requestId: string, type: "REQUEST_CHANGES_REQUIRED" | "REQUEST_APPROVED" | "REQUEST_CLOSED", key: string, detail?: string) {
  const [request, recipient] = await Promise.all([requestSummary(tx, requestId), requestRecipient(tx, requestId)]);
  if (!recipient) return [];
  const subjects = { REQUEST_CHANGES_REQUIRED: "Änderung erforderlich", REQUEST_APPROVED: "Antrag freigegeben", REQUEST_CLOSED: "Änderungsantrag abgeschlossen" };
  const row = await queueNotification(tx, { type, idempotencyKey: `${key}:${recipient.id}`, recipientUserId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name, changeRequestId: requestId, subject: `${subjects[type]} | ${request.number}`, templateData: { number: request.number, title: request.title, machineTypes: request.machineTypes.map(({ machineType }) => machineType.code).join(", "), applicantName: request.applicantName, status: STATUS_LABELS[request.status], detail, url: appUrl(`/change-requests/${requestId}`) } });
  return [row.id];
}

export async function queueTaskAssignmentNotification(tx: Prisma.TransactionClient, taskId: string, eventKey: string) {
  const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, select: { id: true, title: true, priority: true, dueDate: true, responsibleUser: { select: { id: true, email: true, name: true, active: true } }, changeRequest: { select: { id: true, number: true, title: true } } } });
  const recipient = task.responsibleUser ? await centralUser(task.responsibleUser.id,tx) : null;
  if (!recipient) return [];
  const reassigned = eventKey.startsWith("assigned:");
  const row = await queueNotification(tx, { type: "TASK_ASSIGNED", idempotencyKey: `task:${task.id}:${eventKey}:${recipient.id}`, recipientUserId: recipient.id, recipientEmail: recipient.email, recipientName: recipient.name, changeRequestId: task.changeRequest.id, taskId: task.id, subject: `${reassigned ? "Aufgabe neu zugewiesen" : "Neue Aufgabe"} | ${task.changeRequest.number}`, templateData: { number: task.changeRequest.number, title: task.title, detail: `${reassigned ? "Neu zugewiesen. " : ""}Priorität: ${task.priority}${task.dueDate ? `, fällig: ${task.dueDate.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}` : ""}`, url: appUrl(`/change-requests/${task.changeRequest.id}?tab=Aufgaben#task-${task.id}`) } });
  return [row.id];
}
