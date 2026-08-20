import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/modules/auth";
import { db } from "@/server/db/client";
import {
  assertAdministratorRemains,
  hasUserBusinessHistory,
  USER_BUSINESS_RELATION_SELECT,
  USER_HAS_BUSINESS_HISTORY_MESSAGE,
} from "./domain";

export const DELETE_SELF_MESSAGE = "Sie können Ihr eigenes aktuell angemeldetes Benutzerkonto nicht löschen.";

export async function deleteUnusedUser(
  actor: Pick<AuthUser, "id" | "name" | "roles">,
  targetUserId: string,
  client: typeof db = db,
): Promise<void> {
  if (!actor.roles.includes("ADMINISTRATOR")) {
    throw new Error("Sie besitzen keine Berechtigung für diese Funktion.");
  }
  if (actor.id === targetUserId) throw new Error(DELETE_SELF_MESSAGE);

  await client.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        roles: { select: { role: { select: { key: true } } } },
        _count: { select: USER_BUSINESS_RELATION_SELECT },
      },
    });
    if (!target) throw new Error("Benutzer wurde nicht gefunden.");

    const targetRoles = target.roles.map(({ role }) => role.key);
    const targetIsActiveAdministrator = target.active && targetRoles.includes("ADMINISTRATOR");
    if (targetIsActiveAdministrator) {
      const activeAdministratorCount = await tx.user.count({
        where: { active: true, roles: { some: { role: { key: "ADMINISTRATOR" } } } },
      });
      assertAdministratorRemains(activeAdministratorCount, true, true);
    }

    if (hasUserBusinessHistory(target._count)) {
      throw new Error(USER_HAS_BUSINESS_HISTORY_MESSAGE);
    }

    await tx.session.deleteMany({ where: { userId: targetUserId } });
    await tx.userRole.deleteMany({ where: { userId: targetUserId } });
    await tx.auditEvent.create({
      data: {
        userId: actor.id,
        action: "USER_DELETED",
        entityType: "User",
        entityId: targetUserId,
        summary: `${actor.name} hat das unbenutzte Benutzerkonto ${target.name} endgültig gelöscht.`,
        details: { deletedUserEmail: target.email },
      },
    });
    await tx.user.delete({ where: { id: targetUserId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
