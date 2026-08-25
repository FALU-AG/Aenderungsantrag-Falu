import type { Prisma } from "@prisma/client";
import type { RoleKey } from "@/modules/auth/types";

export function explicitApprovalNotificationRoles(roles: readonly RoleKey[]) {
  return (["AVOR", "TECHNICAL"] as const).filter((role) => roles.includes(role));
}

export async function activeRoleRecipients(tx: Prisma.TransactionClient, roleKey: "AVOR" | "TECHNICAL") {
  return tx.user.findMany({ where: { active: true, roles: { some: { role: { key: roleKey } } } }, select: { id: true, email: true, name: true }, distinct: ["id"] });
}

export async function requestRecipient(tx: Prisma.TransactionClient, requestId: string) {
  return tx.changeRequest.findUniqueOrThrow({ where: { id: requestId }, select: { applicant: { select: { id: true, email: true, name: true, active: true } } } }).then(({ applicant }) => applicant?.active ? applicant : null);
}
