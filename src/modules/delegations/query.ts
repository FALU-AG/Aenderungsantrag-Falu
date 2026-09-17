import { db } from "@/server/db/client";
import type { DelegationScopeKey } from "./domain";

export async function loadDelegationPageData(userId: string, admin = false) {
  const [users, owners, delegations] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, name: true } }),
    db.user.findMany({
      where: { active: true, roles: { some: { role: { key: { in: ["AVOR", "TECHNICAL"] } } } } },
      select: { id: true, name: true, roles: { select: { role: { select: { key: true } } } } },
    }),
    db.approvalDelegation.findMany({ where: admin ? {} : { delegatingUserId: userId }, orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }], include: { delegatingUser: { select: { id: true, name: true } }, substituteUser: { select: { id: true, name: true } } } }),
  ]);
  return {
    users,
    owners: owners.map((owner) => ({ id: owner.id, name: owner.name, scopes: owner.roles.flatMap(({ role }) => role.key === "AVOR" ? ["AVOR_APPROVAL" as DelegationScopeKey] : role.key === "TECHNICAL" ? ["TECHNICAL_APPROVAL" as DelegationScopeKey] : []) })),
    delegations,
  };
}
