import type { StorageProvider } from "@prisma/client";
import { db } from "@/server/db/client";
import { removeStoredAttachment } from "@/server/storage/attachment-storage";

export const PROTECTED_USER_EMAIL = "kaufmann@falu.com";
export const DEMO_USERS = [
  { id: "sample-max-muster", email: "max.muster@example.falu.ch" },
  { id: "sample-anna-avor", email: "anna.avor@example.falu.ch" },
  { id: "sample-thomas-technik", email: "thomas.technik@example.falu.ch" },
  { id: "sample-petra-einkauf", email: "petra.einkauf@example.falu.ch" },
  { id: "sample-admin-falu", email: "admin@example.falu.ch" },
] as const;
export const DEMO_CHANGE_REQUEST_NUMBERS = Array.from({ length: 25 }, (_, index) => `CR-2026-${String(index + 1).padStart(3, "0")}`);

type CleanupDatabase = typeof db;
type StorageRemoval = (provider: StorageProvider, key: string) => Promise<void>;
type Counts = { users: number; changeRequests: number; tasks: number; approvals: number; finalApprovals: number; reviews: number; attachments: number; comments: number; auditEvents: number };
export type DemoCleanupResult = { executed: boolean; empty: boolean; counts: Counts; users: { id: string; name: string; email: string }[]; requestNumbers: string[]; skippedUsers: string[] };

export async function cleanupDemoData(client: CleanupDatabase, execute = false, removeStorage: StorageRemoval = removeStoredAttachment): Promise<DemoCleanupResult> {
  const allowedIds = DEMO_USERS.map((user) => user.id);
  const users = await client.user.findMany({ where: { OR: DEMO_USERS.map(({ id, email }) => ({ id, email })) }, select: { id: true, name: true, email: true } });
  if (users.some((user) => user.email.toLowerCase() === PROTECTED_USER_EMAIL)) throw new Error(`Protected production user ${PROTECTED_USER_EMAIL} appeared in the demo deletion set.`);
  for (const user of users) {
    const expected = DEMO_USERS.find((candidate) => candidate.id === user.id && candidate.email === user.email.toLowerCase());
    if (!expected) throw new Error(`Ambiguous demo user identity detected for ${user.email}. Cleanup aborted.`);
  }

  const requests = await client.changeRequest.findMany({
    where: { number: { in: DEMO_CHANGE_REQUEST_NUMBERS } },
    select: { id: true, number: true, applicantId: true, attachments: { select: { id: true, changeRequestId: true, storageProvider: true, storageKey: true } } },
  });
  if (requests.some((request) => !allowedIds.includes(request.applicantId as (typeof allowedIds)[number]))) throw new Error("A seeded change-request number is owned by a non-demo user. Cleanup aborted.");
  const requestIds = requests.map((request) => request.id);
  const attachments = requests.flatMap((request) => request.attachments);

  const [tasks, approvals, finalApprovals, technicalReviews, avorReviews, purchasingReviews, comments, auditEvents] = requestIds.length ? await Promise.all([
    client.task.count({ where: { changeRequestId: { in: requestIds } } }),
    client.approval.count({ where: { changeRequestId: { in: requestIds } } }),
    client.finalApproval.count({ where: { changeRequestId: { in: requestIds } } }),
    client.technicalReview.count({ where: { changeRequestId: { in: requestIds } } }),
    client.avorImpactReview.count({ where: { changeRequestId: { in: requestIds } } }),
    client.purchasingReview.count({ where: { changeRequestId: { in: requestIds } } }),
    client.comment.count({ where: { changeRequestId: { in: requestIds } } }),
    client.auditEvent.count({ where: { changeRequestId: { in: requestIds } } }),
  ]) : [0, 0, 0, 0, 0, 0, 0, 0];

  const deletableUsers: typeof users = [];
  const skippedUsers: string[] = [];
  for (const user of users) {
    const relationCounts = await client.user.findUniqueOrThrow({ where: { id: user.id }, select: { _count: { select: {
      requests: { where: { id: { notIn: requestIds } } }, approvals: { where: { changeRequestId: { notIn: requestIds } } }, finalApprovals: { where: { changeRequestId: { notIn: requestIds } } }, technicalReviews: { where: { changeRequestId: { notIn: requestIds } } }, avorReviews: { where: { changeRequestId: { notIn: requestIds } } }, purchasingReviews: { where: { changeRequestId: { notIn: requestIds } } }, placedPurchaseOrders: { where: { changeRequestId: { notIn: requestIds } } }, assignedTasks: { where: { changeRequestId: { notIn: requestIds } } }, createdTasks: { where: { changeRequestId: { notIn: requestIds } } }, completedTasks: { where: { changeRequestId: { notIn: requestIds } } }, attachments: { where: { changeRequestId: { notIn: requestIds } } }, comments: { where: { changeRequestId: { notIn: requestIds } } }, auditEvents: { where: { OR: [{ changeRequestId: null }, { changeRequestId: { notIn: requestIds } }] } }, closedRequests: { where: { id: { notIn: requestIds } } },
    } } } });
    if (Object.values(relationCounts._count).some((count) => count > 0)) skippedUsers.push(user.email);
    else deletableUsers.push(user);
  }

  const counts: Counts = { users: deletableUsers.length, changeRequests: requests.length, tasks, approvals, finalApprovals, reviews: technicalReviews + avorReviews + purchasingReviews, attachments: attachments.length, comments, auditEvents };
  const empty = requests.length === 0 && users.length === 0;
  const result = { executed: execute, empty, counts, users, requestNumbers: requests.map((request) => request.number), skippedUsers };
  if (!execute || empty) return result;

  for (const attachment of attachments) {
    if (attachment.storageProvider === "SUPABASE" && !attachment.storageKey.startsWith(`change-requests/${attachment.changeRequestId}/${attachment.id}/`)) throw new Error(`Unsafe Storage key detected for demo attachment ${attachment.id}. Cleanup aborted.`);
    await removeStorage(attachment.storageProvider, attachment.storageKey);
  }

  await client.$transaction(async (tx) => {
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
    await tx.changeRequest.deleteMany({ where: { id: { in: requestIds } } });
    const userIds = deletableUsers.map((user) => user.id);
    await tx.session.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds }, email: { in: deletableUsers.map((user) => user.email) } } });
  });
  return result;
}

export function formatDemoCleanupResult(result: DemoCleanupResult): string {
  if (result.empty) return "No demo data found. Nothing to delete.";
  const lines = [result.executed ? "Demo cleanup completed." : "Demo cleanup dry run", "", "Users:", ...result.users.map((user) => `- ${user.name} <${user.email}>`), "", "Change requests:", ...result.requestNumbers.map((number) => `- ${number}`), "", `Tasks: ${result.counts.tasks}`, `Approvals: ${result.counts.approvals}`, `Final approvals: ${result.counts.finalApprovals}`, `Reviews: ${result.counts.reviews}`, `Attachments: ${result.counts.attachments}`, `Comments: ${result.counts.comments}`, `Audit events: ${result.counts.auditEvents}`];
  if (result.skippedUsers.length) lines.push("", "Skipped:", ...result.skippedUsers.map((email) => `- Demo user ${email} has non-demo relationships and was not deleted.`));
  if (!result.executed) lines.push("", "No data was changed.");
  else lines.push("", "Deleted:", `- Users: ${result.counts.users}`, `- Change requests: ${result.counts.changeRequests}`, `- Tasks: ${result.counts.tasks}`, `- Approvals: ${result.counts.approvals}`, `- Final approvals: ${result.counts.finalApprovals}`, `- Reviews: ${result.counts.reviews}`, `- Attachments: ${result.counts.attachments}`, `- Comments: ${result.counts.comments}`, `- Audit events: ${result.counts.auditEvents}`);
  return lines.join("\n");
}
