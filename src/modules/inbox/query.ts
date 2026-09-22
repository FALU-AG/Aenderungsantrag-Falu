import { centralUsers } from "@/modules/auth/directory";
import { cache } from "react";
import type { AuthUser, RoleKey } from "@/modules/auth";
import { db } from "@/server/db/client";
import { buildPersonalInbox } from "./domain";

const load = cache(async (userId: string, rolesKey: string) => {
  const roles = rolesKey.split(",").filter(Boolean) as RoleKey[];
  const now = new Date();
  const directory = await centralUsers();
  const delegations = await db.approvalDelegation.findMany({ where: { substituteUserId: userId, enabled: true, startsAt: { lte: now }, endsAt: { gte: now }, delegatingUserId: { in: directory.map((u)=>u.id) } }, orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }, { id: "asc" }], select: { scope: true, delegatingUser: { select: { id: true, name: true } } } });
  const delegatedApprovals = delegations.flatMap((delegation) => {
    const type = delegation.scope === "AVOR_APPROVAL" ? "AVOR" as const : "TECHNICAL" as const;
    return directory.find((u)=>u.id===delegation.delegatingUser.id)?.roles.some(({ role }) => role.key === type) ? [{ type, delegatingUserName: delegation.delegatingUser.name }] : [];
  });
  const hasWorkflowRole = roles.includes("AVOR") || roles.includes("TECHNICAL") || delegatedApprovals.length > 0;
  const [tasks, requests] = await Promise.all([
    db.task.findMany({
      where: { responsibleUserId: userId, status: { not: "DONE" } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        changeRequest: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            machineTypes: { select: { machineType: { select: { code: true } } } },
          },
        },
      },
    }),
    db.changeRequest.findMany({
          where: {
            OR: [
              ...(hasWorkflowRole ? [{ status: { not: "CLOSED" as const } }] : []),
              { applicantId: userId, status: "CHANGES_REQUESTED" as const },
            ],
          },
          select: {
            id: true,
            applicantId: true,
            number: true,
            title: true,
            status: true,
            approvalCycle: true,
            finalReviewCycle: true,
            machineTypes: { select: { machineType: { select: { code: true } } } },
            approvals: {
              select: { type: true, status: true, cycle: true },
            },
            finalApprovals: { select: { type: true, cycle: true } },
            technicalReview: { select: { completed: true } },
            avorImpactReview: { select: { completed: true } },
            purchasingReview: { select: { completed: true } },
          },
        }),
  ]);
  return buildPersonalInbox({ userId, roles, requests, tasks, delegatedApprovals });
});

export function loadPersonalInbox(user: Pick<AuthUser, "id" | "roles">) {
  return load(user.id, [...user.roles].sort().join(","));
}
