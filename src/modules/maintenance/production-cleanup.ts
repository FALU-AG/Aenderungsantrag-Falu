import path from "node:path";
import type { StorageProvider } from "@prisma/client";
import { db } from "@/server/db/client";
import { removeStoredAttachmentNode } from "@/server/storage/attachment-storage-node";

export const PRODUCTION_CLEANUP_CONFIRMATION = "DELETE_ALL_CHANGE_REQUESTS";

export const PRODUCTION_DATA_CLASSIFICATION = {
  transactional: ["ChangeRequest", "ChangeRequestMachineType", "ChangeRequestReason", "Approval", "FinalApproval", "TechnicalReview", "AvorImpactReview", "PurchasingReview", "Task", "Attachment", "Comment", "ChangeRequest-linked AuditEvent", "ChangeRequest/Task-linked EmailNotification", "embedded finalComment/closingRemarks"],
  master: ["MachineType", "ChangeReason", "AppSetting"],
  userAndAuth: ["User", "Role", "UserRole", "Session", "PasswordResetToken", "ApprovalDelegation"],
  ambiguous: ["AuditEvent without changeRequestId", "EmailNotification without target ChangeRequest/Task", "unreferenced Storage objects", "ChangeRequestCounter rows for other years"],
} as const;

type CleanupDatabase = typeof db;
type StorageRemoval = (provider: StorageProvider, key: string) => Promise<void>;
type AttachmentRef = { id: string; changeRequestId: string; storageProvider: StorageProvider; storageKey: string };
type RequestRef = { id: string; number: string; updatedAt: Date; tasks: { id: string }[]; attachments: AttachmentRef[] };

export type ProductionCleanupCounts = {
  changeRequests: number;
  machineTypeAssignments: number;
  reasonAssignments: number;
  approvals: number;
  finalApprovals: number;
  technicalReviews: number;
  avorReviews: number;
  purchasingReviews: number;
  tasks: number;
  attachments: number;
  comments: number;
  auditEvents: number;
  notifications: number;
  completionSummaries: number;
};

export type PreservedCounts = {
  users: number; roles: number; userRoles: number; sessions: number; passwordResetTokens: number;
  delegations: number; machineTypes: number; changeReasons: number; appSettings: number;
  unrelatedAuditEvents: number; unrelatedNotifications: number; otherYearCounters: number;
};

export type ProductionCleanupResult = {
  executed: boolean;
  requestNumbers: string[];
  counts: ProductionCleanupCounts;
  attachments: AttachmentRef[];
  users: Array<{ id: string; name: string; email: string; active: boolean; externalId: string | null }>;
  preserved: PreservedCounts;
  numbering: { year: number; currentNextNumber: number | null; proposedNextNumber: 1; proposedFirstNumber: string };
  storage: { removed: number; failures: Array<{ provider: StorageProvider; key: string }> };
};

export class ProductionCleanupStorageError extends Error {
  constructor(public readonly removed: number, public readonly failures: Array<{ provider: StorageProvider; key: string }>) {
    super(`Storage cleanup failed for ${failures.length} object(s). Database cleanup was not started. ${removed} object(s) were already removed; rerun is safe after resolving Storage access.`);
    this.name = "ProductionCleanupStorageError";
  }
}

export function productionCleanupYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Zurich" }).format(date));
}

export function validateProductionCleanupExecution(execute: boolean, confirmation?: string) {
  if (execute && confirmation !== PRODUCTION_CLEANUP_CONFIRMATION)
    throw new Error(`Execution refused. Set PRODUCTION_CLEANUP_CONFIRM=${PRODUCTION_CLEANUP_CONFIRMATION} and pass --execute.`);
}

function validateAttachmentKey(attachment: AttachmentRef) {
  if (!attachment.storageKey.trim()) throw new Error(`Unsafe empty Storage key for attachment ${attachment.id}.`);
  if (attachment.storageProvider === "SUPABASE" && !attachment.storageKey.startsWith(`change-requests/${attachment.changeRequestId}/${attachment.id}/`))
    throw new Error(`Unsafe Supabase Storage key for attachment ${attachment.id}. Cleanup aborted.`);
  if (attachment.storageProvider === "LOCAL" && (path.basename(attachment.storageKey) !== attachment.storageKey || !/^[a-zA-Z0-9._-]+$/.test(attachment.storageKey)))
    throw new Error(`Unsafe local Storage key for attachment ${attachment.id}. Cleanup aborted.`);
}

function requestFingerprint(requests: RequestRef[]) {
  return requests.map((request) => [request.id, request.number, request.updatedAt.toISOString(), request.tasks.map(({ id }) => id).sort().join(","), request.attachments.map(({ id }) => id).sort().join(",")].join("|")).sort().join("\n");
}

async function loadRequests(client: CleanupDatabase): Promise<RequestRef[]> {
  return client.changeRequest.findMany({
    orderBy: [{ number: "asc" }, { id: "asc" }],
    select: { id: true, number: true, updatedAt: true, tasks: { select: { id: true }, orderBy: { id: "asc" } }, attachments: { select: { id: true, changeRequestId: true, storageProvider: true, storageKey: true }, orderBy: { id: "asc" } } },
  });
}

async function loadTransactionalCounts(client: CleanupDatabase, requests: RequestRef[]): Promise<ProductionCleanupCounts> {
  const requestIds = requests.map(({ id }) => id);
  const taskIds = requests.flatMap(({ tasks }) => tasks.map(({ id }) => id));
  if (!requestIds.length) return { changeRequests: 0, machineTypeAssignments: 0, reasonAssignments: 0, approvals: 0, finalApprovals: 0, technicalReviews: 0, avorReviews: 0, purchasingReviews: 0, tasks: 0, attachments: 0, comments: 0, auditEvents: 0, notifications: 0, completionSummaries: 0 };
  const where = { changeRequestId: { in: requestIds } };
  const [machineTypeAssignments, reasonAssignments, approvals, finalApprovals, technicalReviews, avorReviews, purchasingReviews, tasks, attachments, comments, auditEvents, notifications, completionSummaries] = await Promise.all([
    client.changeRequestMachineType.count({ where }), client.changeRequestReason.count({ where }), client.approval.count({ where }), client.finalApproval.count({ where }), client.technicalReview.count({ where }), client.avorImpactReview.count({ where }), client.purchasingReview.count({ where }), client.task.count({ where }), client.attachment.count({ where }), client.comment.count({ where }), client.auditEvent.count({ where }), client.emailNotification.count({ where: { OR: [{ changeRequestId: { in: requestIds } }, ...(taskIds.length ? [{ taskId: { in: taskIds } }] : [])] } }), client.changeRequest.count({ where: { id: { in: requestIds }, finalComment: { not: null } } }),
  ]);
  return { changeRequests: requests.length, machineTypeAssignments, reasonAssignments, approvals, finalApprovals, technicalReviews, avorReviews, purchasingReviews, tasks, attachments, comments, auditEvents, notifications, completionSummaries };
}

async function loadPreserved(client: CleanupDatabase, year: number): Promise<{ users: ProductionCleanupResult["users"]; counts: PreservedCounts }> {
  const [users, roles, userRoles, sessions, passwordResetTokens, delegations, machineTypes, changeReasons, appSettings, unrelatedAuditEvents, unrelatedNotifications, otherYearCounters] = await Promise.all([
    client.user.findMany({ orderBy: [{ email: "asc" }], select: { id: true, name: true, email: true, active: true, externalId: true } }),
    client.role.count(), client.userRole.count(), client.session.count(), client.passwordResetToken.count(), client.approvalDelegation.count(), client.machineType.count(), client.changeReason.count(), client.appSetting.count(), client.auditEvent.count({ where: { changeRequestId: null } }), client.emailNotification.count({ where: { changeRequestId: null, taskId: null } }), client.changeRequestCounter.count({ where: { year: { not: year } } }),
  ]);
  return { users, counts: { users: users.length, roles, userRoles, sessions, passwordResetTokens, delegations, machineTypes, changeReasons, appSettings, unrelatedAuditEvents, unrelatedNotifications, otherYearCounters } };
}

export async function productionCleanup(client: CleanupDatabase, options: { execute?: boolean; confirmation?: string; now?: Date } = {}, removeStorage: StorageRemoval = removeStoredAttachmentNode): Promise<ProductionCleanupResult> {
  const execute = options.execute ?? false;
  validateProductionCleanupExecution(execute, options.confirmation);
  const year = productionCleanupYear(options.now);
  const [requests, counter, preserved] = await Promise.all([loadRequests(client), client.changeRequestCounter.findUnique({ where: { year }, select: { nextNumber: true } }), loadPreserved(client, year)]);
  const attachments = requests.flatMap(({ attachments: items }) => items);
  for (const attachment of attachments) validateAttachmentKey(attachment);
  const counts = await loadTransactionalCounts(client, requests);
  const base: ProductionCleanupResult = { executed: false, requestNumbers: requests.map(({ number }) => number), counts, attachments, users: preserved.users, preserved: preserved.counts, numbering: { year, currentNextNumber: counter?.nextNumber ?? null, proposedNextNumber: 1, proposedFirstNumber: `CR-${year}-001` }, storage: { removed: 0, failures: [] } };
  if (!execute) return base;

  let removed = 0;
  const failures: Array<{ provider: StorageProvider; key: string }> = [];
  for (const attachment of attachments) {
    try { await removeStorage(attachment.storageProvider, attachment.storageKey); removed += 1; }
    catch { failures.push({ provider: attachment.storageProvider, key: attachment.storageKey }); }
  }
  if (failures.length) throw new ProductionCleanupStorageError(removed, failures);

  const requestIds = requests.map(({ id }) => id);
  const taskIds = requests.flatMap(({ tasks }) => tasks.map(({ id }) => id));
  try {
    await client.$transaction(async (tx) => {
      await tx.changeRequestCounter.upsert({ where: { year }, create: { year, nextNumber: 1 }, update: { nextNumber: { increment: 0 } } });
      const current = await tx.changeRequest.findMany({ orderBy: [{ number: "asc" }, { id: "asc" }], select: { id: true, number: true, updatedAt: true, tasks: { select: { id: true }, orderBy: { id: "asc" } }, attachments: { select: { id: true, changeRequestId: true, storageProvider: true, storageKey: true }, orderBy: { id: "asc" } } } });
      if (requestFingerprint(current) !== requestFingerprint(requests)) throw new Error("Change Request data changed after the dry-run snapshot. Cleanup aborted.");
      await tx.emailNotification.deleteMany({ where: { OR: [{ changeRequestId: { in: requestIds } }, ...(taskIds.length ? [{ taskId: { in: taskIds } }] : [])] } });
      await tx.changeRequestMachineType.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.changeRequestReason.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.approval.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.finalApproval.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.technicalReview.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.avorImpactReview.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.purchasingReview.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.task.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.attachment.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.comment.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      await tx.auditEvent.deleteMany({ where: { changeRequestId: { in: requestIds } } });
      const deleted = await tx.changeRequest.deleteMany({ where: { id: { in: requestIds } } });
      if (deleted.count !== requests.length) throw new Error("Cleanup did not delete the exact snapshotted Change Request set.");
      if (await tx.changeRequest.count() !== 0) throw new Error("Cleanup left unexpected Change Requests. Counter reset refused.");
      await tx.changeRequestCounter.update({ where: { year }, data: { nextNumber: 1 } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    throw new Error(`Database cleanup failed after ${removed} Storage object(s) were removed. The database transaction was rolled back; rerun after resolving the error. ${error instanceof Error ? error.message : "Unknown database error"}`);
  }

  const [remainingRequests, usersAfter, counterAfter] = await Promise.all([client.changeRequest.count(), client.user.count(), client.changeRequestCounter.findUnique({ where: { year }, select: { nextNumber: true } })]);
  if (remainingRequests !== 0 || usersAfter !== preserved.counts.users || counterAfter?.nextNumber !== 1) throw new Error("Post-cleanup integrity verification failed. Review the database before rollout.");
  return { ...base, executed: true, storage: { removed, failures: [] } };
}

export function formatProductionCleanup(result: ProductionCleanupResult) {
  const c = result.counts; const p = result.preserved;
  const lines = [result.executed ? "PRODUCTION CLEANUP COMPLETED" : "PRODUCTION CLEANUP DRY RUN – NO DATA CHANGED", "", "Transactional Change Request data:", `- ChangeRequests: ${c.changeRequests}`, `- Machine type assignments: ${c.machineTypeAssignments}`, `- Reason assignments: ${c.reasonAssignments}`, `- Approvals: ${c.approvals}`, `- Final approvals: ${c.finalApprovals}`, `- Technical reviews: ${c.technicalReviews}`, `- AVOR reviews: ${c.avorReviews}`, `- Purchasing reviews: ${c.purchasingReviews}`, `- Tasks: ${c.tasks}`, `- Attachments (database): ${c.attachments}`, `- Comments: ${c.comments}`, `- Audit events: ${c.auditEvents}`, `- Request/task notifications and idempotency records: ${c.notifications}`, `- Stored completion summaries: ${c.completionSummaries}`, "", "Requests:", ...(result.requestNumbers.length ? result.requestNumbers.map((number) => `- ${number}`) : ["- None"]), "", `Storage objects: ${result.attachments.length}`, ...result.attachments.map((item) => `- ${item.storageProvider}: ${item.storageKey}`), "", "Preserved users/auth data:", `- Users: ${p.users}`, ...result.users.map((user) => `  - ${user.name} <${user.email}> | ${user.active ? "active" : "inactive"} | SSO mapping: ${user.externalId ? "present" : "absent"}`), `- Roles: ${p.roles}`, `- UserRole assignments: ${p.userRoles}`, `- Sessions: ${p.sessions}`, `- Password reset tokens: ${p.passwordResetTokens}`, `- Approval delegations: ${p.delegations}`, "", "Preserved master/configuration data:", `- Machine types: ${p.machineTypes}`, `- Change reasons: ${p.changeReasons}`, `- App settings: ${p.appSettings}`, "", "Preserved ambiguous/unowned data:", `- Audit events without ChangeRequest: ${p.unrelatedAuditEvents}`, `- Notifications without ChangeRequest/Task: ${p.unrelatedNotifications}`, `- Counter rows for other years: ${p.otherYearCounters}`, "- Unreferenced Storage objects are not enumerated or deleted.", "", "Numbering:", `- Year: ${result.numbering.year}`, `- Current nextNumber: ${result.numbering.currentNextNumber ?? "no row"}`, `- Proposed nextNumber: ${result.numbering.proposedNextNumber}`, `- Proposed first production number: ${result.numbering.proposedFirstNumber}`];
  if (!result.executed) lines.push("", "No database rows or Storage objects were changed.", `Execution requires --execute and PRODUCTION_CLEANUP_CONFIRM=${PRODUCTION_CLEANUP_CONFIRMATION}.`);
  else lines.push("", `Storage objects removed: ${result.storage.removed}`, "Database verification: no Change Requests remain; users preserved; current-year counter is 1.");
  return lines.join("\n");
}
