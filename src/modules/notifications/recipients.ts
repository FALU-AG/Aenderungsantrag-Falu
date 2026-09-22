import { centralUsers, centralUser } from "@/modules/auth/directory";
import type { Prisma } from "@prisma/client";
import type { RoleKey } from "@/modules/auth/types";

export function explicitApprovalNotificationRoles(roles: readonly RoleKey[]) {
  return (["AVOR", "TECHNICAL"] as const).filter((role) => roles.includes(role));
}

export async function activeRoleRecipients(tx: Prisma.TransactionClient, roleKey: "AVOR" | "TECHNICAL") {
  return (await centralUsers(tx)).filter((user)=>user.roles.some(({role})=>role.key===roleKey));
}

export async function requestRecipient(tx: Prisma.TransactionClient, requestId: string) {
  return tx.changeRequest.findUniqueOrThrow({ where: { id: requestId }, select: { applicant: { select: { id: true, email: true, name: true, active: true } } } }).then(({ applicant }) => applicant ? centralUser(applicant.id,tx) : null);
}
