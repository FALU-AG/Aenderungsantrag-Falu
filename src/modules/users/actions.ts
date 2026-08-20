"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole, type RoleKey } from "@/modules/auth";
import { hashPassword, passwordError, validatePassword } from "@/modules/auth/password";
import { invalidateUserSessions } from "@/modules/auth/session";
import { db } from "@/server/db/client";
import { assertAdministratorRemains, normalizeEmail, normalizeRoles, selectableRoles } from "./domain";
import { deleteUnusedUser } from "./delete-user";

export type DeleteUserActionState = { error?: string; success?: boolean };

function values(form: FormData) {
  const roles = normalizeRoles(form.getAll("roles").map(String).filter((role): role is RoleKey => selectableRoles.includes(role as RoleKey)));
  return { firstName: String(form.get("firstName") ?? "").trim(), lastName: String(form.get("lastName") ?? "").trim(), email: normalizeEmail(String(form.get("email") ?? "")), roles, active: form.get("active") === "on" };
}
async function roleIds(keys: readonly RoleKey[]) {
  const roles = await db.role.findMany({ where: { key: { in: [...keys] } } });
  if (roles.length !== keys.length) throw new Error("Die Rollenstammdaten sind unvollständig.");
  return roles;
}
export async function createUser(form: FormData) {
  const actor = await requireRole("ADMINISTRATOR"); const data = values(form); const password = String(form.get("password") ?? "");
  if (!data.firstName || !data.lastName || !data.email || !data.roles.length) throw new Error("Bitte füllen Sie alle Pflichtfelder aus.");
  if (!validatePassword(password)) throw new Error(passwordError);
  const roles = await roleIds(data.roles);
  try { await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...data, name: `${data.firstName} ${data.lastName}`, passwordHash: await hashPassword(password), roles: { create: roles.map((role) => ({ roleId: role.id })) } } });
    await tx.auditEvent.create({ data: { userId: actor.id, action: "USER_CREATED", entityType: "User", entityId: user.id, summary: `${actor.name} hat den Benutzer ${user.name} erstellt.`, details: { roles: data.roles, active: data.active } } });
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Diese E-Mail-Adresse wird bereits verwendet."); throw error; }
  revalidatePath("/admin/users");
}
export async function updateUser(userId: string, form: FormData) {
  const actor = await requireRole("ADMINISTRATOR"); const data = values(form); if (!data.roles.length) throw new Error("Bitte wählen Sie mindestens eine Rolle.");
  const current = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: { include: { role: true } } } });
  const oldRoles = current.roles.map(({ role }) => role.key); const activeAdmins = await db.user.count({ where: { active: true, roles: { some: { role: { key: "ADMINISTRATOR" } } } } });
  assertAdministratorRemains(activeAdmins, current.active && oldRoles.includes("ADMINISTRATOR"), !data.active || !data.roles.includes("ADMINISTRATOR"));
  const roles = await roleIds(data.roles);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { ...data, name: `${data.firstName} ${data.lastName}`, roles: { deleteMany: {}, create: roles.map((role) => ({ roleId: role.id })) } } });
    const changed = [...oldRoles].sort().join() !== [...data.roles].sort().join();
    await tx.auditEvent.create({ data: { userId: actor.id, action: changed ? "USER_ROLES_CHANGED" : data.active === current.active ? "USER_EDITED" : data.active ? "USER_ACTIVATED" : "USER_DEACTIVATED", entityType: "User", entityId: userId, summary: changed ? `Die Rollen von ${current.name} wurden geändert.` : `${actor.name} hat den Benutzer ${data.active === current.active ? "bearbeitet" : data.active ? "aktiviert" : "deaktiviert"}.`, details: { roles: data.roles, active: data.active } } });
    if (!data.active) await tx.session.deleteMany({ where: { userId } });
  });
  revalidatePath("/admin/users");
}
export async function resetPassword(userId: string, form: FormData) {
  const actor = await requireRole("ADMINISTRATOR"); const password = String(form.get("password") ?? ""); if (!validatePassword(password)) throw new Error(passwordError);
  const target = await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
  await invalidateUserSessions(userId);
  await db.auditEvent.create({ data: { userId: actor.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId, summary: `Das Passwort von ${target.name} wurde durch einen Administrator zurückgesetzt.` } });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string, _state: DeleteUserActionState): Promise<DeleteUserActionState> {
  void _state;
  try {
    const actor = await requireRole("ADMINISTRATOR");
    await deleteUnusedUser(actor, userId);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Der Benutzer konnte nicht gelöscht werden." };
  }
}
