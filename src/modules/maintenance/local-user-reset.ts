import type { db } from "@/server/db/client";

export const LOCAL_USER_RESET_CONFIRMATION = "DELETE_ALL_LOCAL_USERS";

export type LocalUserResetCounts = {
  users: number;
  userRoles: number;
  delegations: number;
  auditEvents: number;
  notifications: number;
  sessions: number;
  passwordResetTokens: number;
};
export type LocalUserResetResult = {
  executed: boolean;
  counts: LocalUserResetCounts;
  users: Array<{ name: string; email: string; externalId: string | null }>;
};

type ResetDatabase = Pick<typeof db, "$transaction" | "user" | "userRole" | "approvalDelegation" | "auditEvent" | "emailNotification" | "session" | "passwordResetToken" | "changeRequest" | "approval" | "task" | "comment" | "attachment">;

export function validateLocalUserResetExecution(execute: boolean, confirmation?: string) {
  if (!execute) return;
  if (confirmation !== LOCAL_USER_RESET_CONFIRMATION)
    throw new Error(`Execution requires CONFIRM_LOCAL_USER_RESET=${LOCAL_USER_RESET_CONFIRMATION}.`);
}

/**
 * Removes the local user rows and everything that only exists because of the former local
 * authentication. Identity now comes from the portal, and a local row is recreated on first
 * arrival, so nobody is locked out by this.
 *
 * It is a pre-go-live command only. Once a single change request exists, its applicant,
 * approvals, reviews, tasks, comments, attachments and audit trail all reference local rows,
 * and removing them would destroy that history. The guard below refuses in that case rather
 * than relying on anyone remembering.
 */
export async function localUserReset(client: ResetDatabase, options: { execute?: boolean; confirmation?: string } = {}): Promise<LocalUserResetResult> {
  const execute = options.execute ?? false;
  validateLocalUserResetExecution(execute, options.confirmation);

  const blocking = {
    changeRequests: await client.changeRequest.count(),
    approvals: await client.approval.count(),
    tasks: await client.task.count(),
    comments: await client.comment.count(),
    attachments: await client.attachment.count(),
  };
  const held = Object.entries(blocking).filter(([, value]) => value > 0);
  if (held.length)
    throw new Error(`Refusing to remove users: business data still references them (${held.map(([name, value]) => `${name}: ${value}`).join(", ")}). This command is only for the state before go-live.`);

  const users = await client.user.findMany({ orderBy: { email: "asc" }, select: { name: true, email: true, externalId: true } });
  const counts: LocalUserResetCounts = {
    users: users.length,
    userRoles: await client.userRole.count(),
    delegations: await client.approvalDelegation.count(),
    auditEvents: await client.auditEvent.count(),
    notifications: await client.emailNotification.count(),
    sessions: await client.session.count(),
    passwordResetTokens: await client.passwordResetToken.count(),
  };
  if (!execute) return { executed: false, counts, users };

  await client.$transaction(async (tx) => {
    // Foreign-key-safe order. UserRole, Session and PasswordResetToken would cascade with the
    // user, but deleting them explicitly keeps the reported counts honest.
    await tx.approvalDelegation.deleteMany({});
    await tx.auditEvent.deleteMany({});
    await tx.emailNotification.deleteMany({});
    await tx.session.deleteMany({});
    await tx.passwordResetToken.deleteMany({});
    await tx.userRole.deleteMany({});
    const removed = await tx.user.deleteMany({});
    if (removed.count !== counts.users) throw new Error("User count changed during the reset; nothing was committed.");
  });
  return { executed: true, counts, users };
}

export function formatLocalUserReset(result: LocalUserResetResult) {
  const c = result.counts;
  return [
    result.executed ? "LOCAL USER RESET COMPLETED" : "LOCAL USER RESET DRY RUN - NO DATA CHANGED",
    "",
    "Removed (or to be removed):",
    `- Users: ${c.users}`,
    `- Role assignments: ${c.userRoles}`,
    `- Approval delegations: ${c.delegations}`,
    `- Audit events: ${c.auditEvents}`,
    `- Email notifications: ${c.notifications}`,
    `- Sessions: ${c.sessions}`,
    `- Password reset tokens: ${c.passwordResetTokens}`,
    "",
    "Users:",
    ...(result.users.length ? result.users.map((user) => `- ${user.name} <${user.email}> | portal mapping: ${user.externalId ? "present" : "absent"}`) : ["- None"]),
    "",
    "Preserved: machine types, change reasons, app settings, the request counter and the role catalogue.",
    result.executed
      ? "Each person gets a fresh local row automatically on their first visit, built from signed portal data."
      : "Re-run with --execute and the confirmation variable to apply.",
  ].join("\n");
}
