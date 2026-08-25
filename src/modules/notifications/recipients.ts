import type { Prisma } from "@prisma/client";

export async function activeRoleRecipients(tx: Prisma.TransactionClient, roleKey: "AVOR" | "TECHNICAL") {
  return tx.user.findMany({ where: { active: true, roles: { some: { role: { key: { in: [roleKey, "ADMINISTRATOR"] } } } } }, select: { id: true, email: true, name: true } });
}

export async function requestRecipient(tx: Prisma.TransactionClient, requestId: string) {
  return tx.changeRequest.findUniqueOrThrow({ where: { id: requestId }, select: { applicant: { select: { id: true, email: true, name: true, active: true } } } }).then(({ applicant }) => applicant?.active ? applicant : null);
}
