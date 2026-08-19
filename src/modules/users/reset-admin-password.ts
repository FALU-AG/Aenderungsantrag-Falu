import { hashPassword, MIN_PASSWORD_LENGTH } from "@/modules/auth/password";
import type { PrismaClient } from "@prisma/client";

export type ResetAdminPasswordEnvironment = {
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_PASSWORD?: string;
};

export type ResetDatabase = Pick<PrismaClient, "user" | "$transaction">;

export async function resetAdministratorPassword(
  db: ResetDatabase,
  environment: ResetAdminPasswordEnvironment,
) {
  const rawEmail = environment.BOOTSTRAP_ADMIN_EMAIL;
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD;
  if (!rawEmail?.trim()) throw new Error("BOOTSTRAP_ADMIN_EMAIL is required.");
  if (!password) throw new Error("BOOTSTRAP_ADMIN_PASSWORD is required.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`BOOTSTRAP_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  const email = rawEmail.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      active: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user) throw new Error("Administrator account was not found.");
  if (!user.active) throw new Error("Administrator account is inactive.");
  if (!user.roles.some(({ role }) => role.key === "ADMINISTRATOR")) {
    throw new Error("The specified account is not an Administrator.");
  }

  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditEvent.create({
      data: {
        userId: user.id,
        action: "ADMINISTRATOR_PASSWORD_RECOVERY",
        entityType: "User",
        entityId: user.id,
        summary: `Das Passwort von ${user.name} wurde über den Administrator-Recovery-Prozess zurückgesetzt.`,
      },
    });
  });
}
