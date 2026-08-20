import { describe, expect, it, vi } from "vitest";
import type { AuthUser, RoleKey } from "@/modules/auth";
import { deleteUnusedUser, DELETE_SELF_MESSAGE } from "./delete-user";
import { USER_BUSINESS_RELATIONS, USER_HAS_BUSINESS_HISTORY_MESSAGE } from "./domain";

const emptyCounts = () => Object.fromEntries(USER_BUSINESS_RELATIONS.map((relation) => [relation, 0]));
const actor = (roles: RoleKey[], id = "admin") => ({ id, name: "Admin User", roles }) satisfies Pick<AuthUser, "id" | "name" | "roles">;

function setup(options: { roles?: RoleKey[]; active?: boolean; counts?: Record<string, number>; activeAdmins?: number } = {}) {
  const businessDelete = vi.fn();
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "target",
        name: "Test User",
        email: "test@falu.ch",
        active: options.active ?? true,
        roles: (options.roles ?? ["EMPLOYEE"]).map((key) => ({ role: { key } })),
        _count: { ...emptyCounts(), ...options.counts },
      }),
      count: vi.fn().mockResolvedValue(options.activeAdmins ?? 2),
      delete: vi.fn().mockResolvedValue({ id: "target" }),
    },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
    changeRequest: { deleteMany: businessDelete },
    approval: { deleteMany: businessDelete },
    task: { deleteMany: businessDelete },
  };
  const client = { $transaction: vi.fn(async (callback) => callback(tx)) };
  return { client, tx, businessDelete };
}

describe("sicheres Löschen von Benutzern", () => {
  it("erlaubt einem Administrator das Löschen eines unbenutzten Kontos", async () => {
    const { client, tx } = setup();
    await deleteUnusedUser(actor(["ADMINISTRATOR"]), "target", client as never);
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "target" } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "USER_DELETED", userId: "admin" }) }));
  });

  it.each<RoleKey>(["EMPLOYEE", "AVOR", "TECHNICAL"])("verweigert die Löschung für %s", async (role) => {
    const { client } = setup();
    await expect(deleteUnusedUser(actor([role]), "target", client as never)).rejects.toThrow("Sie besitzen keine Berechtigung");
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it("verhindert das Löschen des aktuell angemeldeten Kontos", async () => {
    const { client } = setup();
    await expect(deleteUnusedUser(actor(["ADMINISTRATOR"], "target"), "target", client as never)).rejects.toThrow(DELETE_SELF_MESSAGE);
  });

  it("schützt den letzten aktiven Administrator", async () => {
    const { client, tx } = setup({ roles: ["ADMINISTRATOR"], activeAdmins: 1 });
    await expect(deleteUnusedUser(actor(["ADMINISTRATOR"]), "target", client as never)).rejects.toThrow("Es muss mindestens ein aktiver Administrator vorhanden sein.");
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it.each([
    ["ChangeRequest", { requests: 1 }],
    ["Approval", { approvals: 1 }],
    ["Task", { createdTasks: 1 }],
    ["AuditEvent", { auditEvents: 1 }],
  ])("blockiert Benutzer mit %s-Historie", async (_label, counts) => {
    const { client, tx } = setup({ counts });
    await expect(deleteUnusedUser(actor(["ADMINISTRATOR"]), "target", client as never)).rejects.toThrow(USER_HAS_BUSINESS_HISTORY_MESSAGE);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("entfernt nur Sessions, Rollenzuordnungen und das Benutzerkonto", async () => {
    const { client, tx, businessDelete } = setup();
    await deleteUnusedUser(actor(["ADMINISTRATOR"]), "target", client as never);
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "target" } });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: "target" } });
    expect(businessDelete).not.toHaveBeenCalled();
  });
});
