import type { AuthUser } from "@/modules/auth";
import type { ApprovalTypeKey } from "@/modules/approvals/domain";
import { db } from "@/server/db/client";
import { scopeForApproval } from "./domain";

export type DelegatedAuthority = { id: string; delegatingUserId: string; delegatingUser: { name: string } };

export async function findActiveDelegatedAuthority(user: Pick<AuthUser, "id" | "roles">, type: ApprovalTypeKey, now = new Date()): Promise<DelegatedAuthority | null> {
  const requiredRole = type === "AVOR" ? "AVOR" : "TECHNICAL";
  if (user.roles.includes("ADMINISTRATOR") || user.roles.includes(requiredRole)) return null;
  return db.approvalDelegation.findFirst({
    where: {
      substituteUserId: user.id, scope: scopeForApproval(type), enabled: true,
      startsAt: { lte: now }, endsAt: { gte: now },
      substituteUser: { active: true }, delegatingUser: { active: true, roles: { some: { role: { key: requiredRole } } } },
    },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: { id: true, delegatingUserId: true, delegatingUser: { select: { name: true } } },
  });
}

export async function resolveApprovalAuthority(user: Pick<AuthUser, "id" | "roles">, type: ApprovalTypeKey) {
  const requiredRole = type === "AVOR" ? "AVOR" : "TECHNICAL";
  if (user.roles.includes("ADMINISTRATOR") || user.roles.includes(requiredRole)) return { allowed: true as const, delegation: null };
  const delegation = await findActiveDelegatedAuthority(user, type);
  return { allowed: Boolean(delegation), delegation };
}
