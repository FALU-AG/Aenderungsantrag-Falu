import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/modules/auth/password";
import { resetAdministratorPassword, type ResetDatabase } from "./reset-admin-password";

function database(options: { exists?: boolean; active?: boolean; admin?: boolean } = {}) {
  const state = {
    passwordHash: "unchanged",
    mustChangePassword: false,
    sessions: 2,
    audit: [] as Array<Record<string, unknown>>,
  };
  const user = options.exists === false ? null : {
    id: "admin-1",
    name: "Admin Falu",
    active: options.active !== false,
    roles: [{ role: { key: options.admin === false ? "EMPLOYEE" : "ADMINISTRATOR" } }],
  };
  const tx = {
    user: { update: vi.fn(async ({ data }: { data: { passwordHash: string; mustChangePassword: boolean } }) => { state.passwordHash = data.passwordHash; state.mustChangePassword = data.mustChangePassword; }) },
    session: { deleteMany: vi.fn(async () => { state.sessions = 0; }) },
    auditEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.audit.push(data); }) },
  };
  const db = {
    user: { findUnique: vi.fn(async () => user) },
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  };
  return { db: db as unknown as ResetDatabase, tx, state };
}

const valid = { BOOTSTRAP_ADMIN_EMAIL: " ADMIN@FALU.CH ", BOOTSTRAP_ADMIN_PASSWORD: "NewSecure1!" };

describe("Administrator password recovery", () => {
  it("resets an active Administrator password", async () => {
    const { db, state } = database();
    await resetAdministratorPassword(db, valid);
    expect(await verifyPassword(valid.BOOTSTRAP_ADMIN_PASSWORD, state.passwordHash)).toBe(true);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "admin@falu.ch" } }));
    expect(state.audit).toHaveLength(1);
    expect(JSON.stringify(state.audit)).not.toContain(valid.BOOTSTRAP_ADMIN_PASSWORD);
  });
  it.each([
    [{ BOOTSTRAP_ADMIN_PASSWORD: "NewSecure1!" }, "BOOTSTRAP_ADMIN_EMAIL is required."],
    [{ BOOTSTRAP_ADMIN_EMAIL: "admin@falu.ch" }, "BOOTSTRAP_ADMIN_PASSWORD is required."],
  ])("rejects missing environment variables", async (environment, message) => {
    await expect(resetAdministratorPassword(database().db, environment)).rejects.toThrow(message);
  });
  it("rejects a password shorter than ten characters", async () => {
    await expect(resetAdministratorPassword(database().db, { ...valid, BOOTSTRAP_ADMIN_PASSWORD: "short" })).rejects.toThrow("at least 10 characters");
  });
  it("rejects an unknown user", async () => {
    await expect(resetAdministratorPassword(database({ exists: false }).db, valid)).rejects.toThrow("was not found");
  });
  it("rejects an inactive user", async () => {
    await expect(resetAdministratorPassword(database({ active: false }).db, valid)).rejects.toThrow("is inactive");
  });
  it("rejects a non-Administrator", async () => {
    await expect(resetAdministratorPassword(database({ admin: false }).db, valid)).rejects.toThrow("is not an Administrator");
  });
  it("invalidates all sessions", async () => {
    const { db, tx, state } = database(); await resetAdministratorPassword(db, valid);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "admin-1" } }); expect(state.sessions).toBe(0);
  });
  it("requires a password change at next login", async () => {
    const { db, state } = database(); await resetAdministratorPassword(db, valid); expect(state.mustChangePassword).toBe(true);
  });
});
