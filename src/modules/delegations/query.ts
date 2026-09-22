import { centralUsers } from "@/modules/auth/directory";
import { db } from "@/server/db/client";
import type { DelegationScopeKey } from "./domain";

export async function loadDelegationPageData(userId: string, admin = false) {
  const [users, owners, delegations] = await Promise.all([
    centralUsers(),
    centralUsers().then((users)=>users.filter((user)=>user.roles.some(({role})=>["AVOR","TECHNICAL"].includes(role.key)))),
    db.approvalDelegation.findMany({ where: admin ? {} : { delegatingUserId: userId }, orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }], include: { delegatingUser: { select: { id: true, name: true } }, substituteUser: { select: { id: true, name: true } } } }),
  ]);
  return {
    users,
    owners: owners.map((owner) => ({ id: owner.id, name: owner.name, scopes: owner.roles.flatMap(({ role }) => role.key === "AVOR" ? ["AVOR_APPROVAL" as DelegationScopeKey] : role.key === "TECHNICAL" ? ["TECHNICAL_APPROVAL" as DelegationScopeKey] : []) })),
    delegations,
  };
}
