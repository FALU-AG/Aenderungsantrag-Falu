import { cache } from "react";
import type { AuthUser, RoleKey } from "@/modules/auth";
import { db } from "@/server/db/client";
import { buildPersonalInbox } from "./domain";

const load = cache(async (userId: string, rolesKey: string) => {
  const roles = rolesKey.split(",").filter(Boolean) as RoleKey[];
  const hasWorkflowRole = roles.includes("AVOR") || roles.includes("TECHNICAL");
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
  return buildPersonalInbox({ userId, roles, requests, tasks });
});

export function loadPersonalInbox(user: Pick<AuthUser, "id" | "roles">) {
  return load(user.id, [...user.roles].sort().join(","));
}
