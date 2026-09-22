import { describe, expect, it, vi } from "vitest";
import { formatLocalUserReset, localUserReset, LOCAL_USER_RESET_CONFIRMATION, validateLocalUserResetExecution } from "./local-user-reset";

const users = [{ name: "Erika Beispiel", email: "beispiel@falu.com", externalId: null }];
function database(overrides: Record<string, number> = {}) {
  const count = (name: string) => vi.fn(async () => overrides[name] ?? 0);
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const tx = {
    approvalDelegation: { deleteMany }, auditEvent: { deleteMany }, emailNotification: { deleteMany },
    session: { deleteMany }, passwordResetToken: { deleteMany }, userRole: { deleteMany },
    user: { deleteMany: vi.fn(async () => ({ count: overrides.users ?? users.length })) },
  };
  return {
    client: {
      $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
      user: { findMany: vi.fn(async () => users), count: count("users") },
      userRole: { count: count("userRoles") },
      approvalDelegation: { count: count("delegations") },
      auditEvent: { count: count("auditEvents") },
      emailNotification: { count: count("notifications") },
      session: { count: count("sessions") },
      passwordResetToken: { count: count("passwordResetTokens") },
      changeRequest: { count: count("changeRequests") },
      approval: { count: count("approvals") },
      task: { count: count("tasks") },
      comment: { count: count("comments") },
      attachment: { count: count("attachments") },
    },
    tx,
  };
}

describe("local user reset", () => {
  it("is a dry run by default and writes nothing", async () => {
    const { client } = database({ delegations: 5, auditEvents: 31 });
    const result = await localUserReset(client as never);
    expect(result.executed).toBe(false);
    expect(result.counts).toMatchObject({ users: 1, delegations: 5, auditEvents: 31 });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("refuses execution without the exact confirmation", async () => {
    const { client } = database();
    await expect(localUserReset(client as never, { execute: true })).rejects.toThrow(/CONFIRM_LOCAL_USER_RESET/);
    await expect(localUserReset(client as never, { execute: true, confirmation: "yes" })).rejects.toThrow();
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  // Once a request exists, its applicant, approvals, tasks, comments and audit trail all point
  // at local rows. Removing them would destroy that history, so the guard is not advisory.
  it.each(["changeRequests", "approvals", "tasks", "comments", "attachments"])("refuses when %s still exist", async (kind) => {
    const { client } = database({ [kind]: 1 });
    await expect(localUserReset(client as never, { execute: true, confirmation: LOCAL_USER_RESET_CONFIRMATION })).rejects.toThrow(/before go-live/);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("removes the rows in a single transaction once confirmed", async () => {
    const { client, tx } = database();
    const result = await localUserReset(client as never, { execute: true, confirmation: LOCAL_USER_RESET_CONFIRMATION });
    expect(result.executed).toBe(true);
    expect(client.$transaction).toHaveBeenCalledOnce();
    for (const table of [tx.approvalDelegation, tx.auditEvent, tx.emailNotification, tx.session, tx.passwordResetToken, tx.userRole]) expect(table.deleteMany).toHaveBeenCalled();
    expect(tx.user.deleteMany).toHaveBeenCalled();
  });

  it("aborts when the user count changed while running", async () => {
    const { client } = database({ users: 7 });
    await expect(localUserReset(client as never, { execute: true, confirmation: LOCAL_USER_RESET_CONFIRMATION })).rejects.toThrow(/nothing was committed/);
  });

  it("names every affected account in the report", () => {
    const report = formatLocalUserReset({ executed: false, users, counts: { users: 1, userRoles: 1, delegations: 0, auditEvents: 0, notifications: 0, sessions: 0, passwordResetTokens: 0 } });
    expect(report).toContain("DRY RUN");
    expect(report).toContain("beispiel@falu.com");
    expect(report).toContain("portal mapping: absent");
  });

  it("accepts the exact confirmation", () => {
    expect(() => validateLocalUserResetExecution(true, LOCAL_USER_RESET_CONFIRMATION)).not.toThrow();
    expect(() => validateLocalUserResetExecution(false)).not.toThrow();
  });
});
