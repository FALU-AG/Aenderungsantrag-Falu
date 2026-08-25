import type { StorageProvider } from "@prisma/client";
import { db } from "@/server/db/client";
import { removeStoredAttachment } from "@/server/storage/attachment-storage";

export const TEST_REQUEST_NUMBERS = ["CR-2026-028", "CR-2026-029"] as const;
type CleanupDatabase = typeof db;
type StorageRemoval = (provider: StorageProvider, key: string) => Promise<void>;
type RelationCounts = {
  changeRequest: number; machineTypes: number; reasons: number; approvals: number;
  finalApprovals: number; technicalReviews: number; avorReviews: number;
  purchasingReviews: number; tasks: number; attachments: number; comments: number;
  auditEvents: number; notifications: number;
};
type RequestSummary = { id: string; number: string; counts: RelationCounts; attachments: { id: string; changeRequestId: string; storageProvider: StorageProvider; storageKey: string }[] };
export type TestRequestCleanupResult = { executed: boolean; requests: RequestSummary[]; unrelatedRequestsBefore: number; unrelatedRequestsAfter: number; usersBefore: number; usersAfter: number };

const exactTargets = (numbers: string[]) => numbers.length === 2 && [...numbers].sort().every((number, index) => number === [...TEST_REQUEST_NUMBERS].sort()[index]);

async function relationCounts(client: CleanupDatabase, requestId: string, taskIds: string[]): Promise<RelationCounts> {
  const where = { changeRequestId: requestId };
  const [machineTypes, reasons, approvals, finalApprovals, technicalReviews, avorReviews, purchasingReviews, tasks, attachments, comments, auditEvents, notifications] = await Promise.all([
    client.changeRequestMachineType.count({ where }), client.changeRequestReason.count({ where }),
    client.approval.count({ where }), client.finalApproval.count({ where }),
    client.technicalReview.count({ where }), client.avorImpactReview.count({ where }),
    client.purchasingReview.count({ where }), client.task.count({ where }),
    client.attachment.count({ where }), client.comment.count({ where }), client.auditEvent.count({ where }),
    client.emailNotification.count({ where: { OR: [{ changeRequestId: requestId }, ...(taskIds.length ? [{ taskId: { in: taskIds } }] : [])] } }),
  ]);
  return { changeRequest: 1, machineTypes, reasons, approvals, finalApprovals, technicalReviews, avorReviews, purchasingReviews, tasks, attachments, comments, auditEvents, notifications };
}

function validateResolvedRequests(requests: { id: string; number: string }[]) {
  if (requests.length !== 2 || !exactTargets(requests.map(({ number }) => number)))
    throw new Error("Abbruch: CR-2026-028 und CR-2026-029 müssen beide und ausschliesslich vorhanden sein.");
  if (new Set(requests.map(({ id }) => id)).size !== 2) throw new Error("Abbruch: Die Zielanträge konnten nicht eindeutig aufgelöst werden.");
}

function validateAttachmentKey(attachment: RequestSummary["attachments"][number]) {
  if (attachment.storageProvider === "SUPABASE" && !attachment.storageKey.startsWith(`change-requests/${attachment.changeRequestId}/${attachment.id}/`))
    throw new Error(`Abbruch: unsicherer Storage-Pfad für Anhang ${attachment.id}.`);
}

export async function deleteTestChangeRequests(client: CleanupDatabase, execute = false, removeStorage: StorageRemoval = removeStoredAttachment): Promise<TestRequestCleanupResult> {
  const resolved = await client.changeRequest.findMany({
    where: { number: { in: [...TEST_REQUEST_NUMBERS] } }, orderBy: { number: "asc" },
    select: { id: true, number: true, tasks: { select: { id: true } }, attachments: { select: { id: true, changeRequestId: true, storageProvider: true, storageKey: true } } },
  });
  validateResolvedRequests(resolved);
  const requestIds = resolved.map(({ id }) => id);
  const [unrelatedRequestsBefore, usersBefore] = await Promise.all([
    client.changeRequest.count({ where: { id: { notIn: requestIds } } }), client.user.count(),
  ]);
  const requests: RequestSummary[] = await Promise.all(resolved.map(async (request) => ({ id: request.id, number: request.number, attachments: request.attachments, counts: await relationCounts(client, request.id, request.tasks.map(({ id }) => id)) })));
  for (const request of requests) for (const attachment of request.attachments) validateAttachmentKey(attachment);
  const dryRun: TestRequestCleanupResult = { executed: false, requests, unrelatedRequestsBefore, unrelatedRequestsAfter: unrelatedRequestsBefore, usersBefore, usersAfter: usersBefore };
  if (!execute) return dryRun;

  // Storage cannot participate in the PostgreSQL transaction. Exact, preflight-validated objects are removed first;
  // any Storage error aborts before database mutation, allowing the same guarded command to be retried safely.
  for (const request of requests) for (const attachment of request.attachments)
    await removeStorage(attachment.storageProvider, attachment.storageKey);

  await client.$transaction(async (tx) => {
    const locked = await tx.changeRequest.findMany({ where: { id: { in: requestIds }, number: { in: [...TEST_REQUEST_NUMBERS] } }, select: { id: true, number: true, attachments: { select: { id: true } } } });
    validateResolvedRequests(locked);
    const expectedAttachmentIds = requests.flatMap(({ attachments }) => attachments.map(({ id }) => id)).sort();
    const currentAttachmentIds = locked.flatMap(({ attachments }) => attachments.map(({ id }) => id)).sort();
    if (expectedAttachmentIds.join("|") !== currentAttachmentIds.join("|")) throw new Error("Abbruch: Die Anhänge haben sich seit dem Dry Run geändert.");
    const taskIds = requests.flatMap((request) => resolved.find(({ id }) => id === request.id)?.tasks.map(({ id }) => id) ?? []);
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
    const deleted = await tx.changeRequest.deleteMany({ where: { id: { in: requestIds }, number: { in: [...TEST_REQUEST_NUMBERS] } } });
    if (deleted.count !== 2) throw new Error("Abbruch: Es wurden nicht exakt zwei Zielanträge gelöscht.");
  }, { isolationLevel: "Serializable" });

  const [remainingTargets, unrelatedRequestsAfter, usersAfter] = await Promise.all([
    client.changeRequest.count({ where: { number: { in: [...TEST_REQUEST_NUMBERS] } } }),
    client.changeRequest.count({ where: { id: { notIn: requestIds } } }), client.user.count(),
  ]);
  if (remainingTargets !== 0 || unrelatedRequestsAfter !== unrelatedRequestsBefore || usersAfter !== usersBefore)
    throw new Error("Nachkontrolle fehlgeschlagen: Ziel-, Fremdantrags- oder Benutzerbestand ist unerwartet.");
  return { executed: true, requests, unrelatedRequestsBefore, unrelatedRequestsAfter, usersBefore, usersAfter };
}

export function formatTestRequestCleanup(result: TestRequestCleanupResult) {
  const lines = [result.executed ? "Testanträge wurden endgültig gelöscht." : "Dry Run – keine Daten wurden geändert."];
  for (const request of result.requests) {
    lines.push("", request.number);
    for (const [label, key] of [["ChangeRequest", "changeRequest"], ["Maschinentyp-Zuordnungen", "machineTypes"], ["Änderungsgründe", "reasons"], ["Freigaben", "approvals"], ["Abschlussfreigaben", "finalApprovals"], ["Technische Prüfungen", "technicalReviews"], ["AVOR-Prüfungen", "avorReviews"], ["Einkaufsprüfungen", "purchasingReviews"], ["Aufgaben", "tasks"], ["Anhänge", "attachments"], ["Kommentare", "comments"], ["Audit-Ereignisse", "auditEvents"], ["E-Mail-Benachrichtigungen", "notifications"]] as const)
      lines.push(`- ${label}: ${request.counts[key]}`);
    for (const attachment of request.attachments) lines.push(`- Storage-Objekt (${attachment.storageProvider}): ${attachment.storageKey}`);
  }
  lines.push("", `Unveränderte fremde Anträge: ${result.unrelatedRequestsAfter}`, `Unveränderte Benutzer: ${result.usersAfter}`, "Nummernkreis: nicht verändert");
  return lines.join("\n");
}
