"use server";
import { centralUser } from "@/modules/auth/directory";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth";
import { db } from "@/server/db/client";
import { canManageDelegation, DELEGATION_SCOPE_LABELS, delegationInputSchema, delegationMateriallyChanged, parseZurichDateTimeLocal, roleForScope, shouldNotifyManualCancellation } from "./domain";
import { queueApprovalCycleNotifications } from "@/modules/notifications/workflow";
import { sendNotifications } from "@/modules/notifications/service";
import { notifyDelegation } from "@/modules/notifications/delegation";

const values = (formData: FormData, delegatingUserId: string) => delegationInputSchema.parse({
  delegatingUserId,
  substituteUserId: String(formData.get("substituteUserId") ?? ""),
  scope: String(formData.get("scope") ?? ""),
  startsAt: parseZurichDateTimeLocal(String(formData.get("startsAt") ?? "")),
  endsAt: parseZurichDateTimeLocal(String(formData.get("endsAt") ?? "")),
});

async function assertManageable(actor: Awaited<ReturnType<typeof getCurrentUser>>, delegatingUserId: string) {
  if (actor.id !== delegatingUserId && !actor.roles.includes("ADMINISTRATOR")) throw new Error("Sie dürfen diese Stellvertretung nicht verwalten.");
}

function assertScopeManagement(actor: Awaited<ReturnType<typeof getCurrentUser>>, delegatingUserId: string, scope: ReturnType<typeof values>["scope"]) {
  if (!canManageDelegation(actor, delegatingUserId, scope)) throw new Error("Sie dürfen diese Freigabeverantwortung nicht delegieren.");
}

async function validateUsersAndOverlap(input: ReturnType<typeof values>, excludeId?: string) {
  const [owner, substitute, overlap] = await Promise.all([
    centralUser(input.delegatingUserId),
    centralUser(input.substituteUserId),
    db.approvalDelegation.findFirst({ where: { id: excludeId ? { not: excludeId } : undefined, delegatingUserId: input.delegatingUserId, scope: input.scope, enabled: true, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } }, select: { id: true } }),
  ]);
  if (!owner?.active || !owner.roles.some(({ role }) => role.key === roleForScope(input.scope))) throw new Error("Die delegierende Person besitzt die erforderliche Rolle nicht.");
  if (!substitute?.active) throw new Error("Der Stellvertreter muss aktiv sein.");
  if (overlap) throw new Error("Für diesen Zeitraum besteht bereits eine Stellvertretung derselben Freigabe.");
}

export async function createDelegation(formData: FormData) {
  const actor = await getCurrentUser();
  const delegatingUserId = String(formData.get("delegatingUserId") || actor.id);
  await assertManageable(actor, delegatingUserId);
  const input = values(formData, delegatingUserId);
  assertScopeManagement(actor, delegatingUserId, input.scope);
  await validateUsersAndOverlap(input);
  const delegation = await db.$transaction(async (tx) => {
    const delegation = await tx.approvalDelegation.create({ data: { ...input, createdById: actor.id } });
    await tx.auditEvent.create({ data: { userId: actor.id, action: "DELEGATION_CREATED", entityType: "ApprovalDelegation", entityId: delegation.id, summary: `${actor.name} hat eine Stellvertretung für ${DELEGATION_SCOPE_LABELS[input.scope]} erstellt.`, details: { delegatingUserId, substituteUserId: input.substituteUserId, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt } } });
    return delegation;
  });
  const [delegatingUser, substitute] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: delegatingUserId }, select: { id: true, name: true } }),
    db.user.findUniqueOrThrow({ where: { id: input.substituteUserId }, select: { id: true, name: true, email: true } }),
  ]);
  await notifyDelegation({ delegationId: delegation.id, event: "CREATED", delegatingUser, substitute, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt, auditActorId: actor.id });
  if (input.startsAt <= new Date() && input.endsAt >= new Date()) {
    try {
      const open = await db.changeRequest.findMany({ where: { status: "UNDER_REVIEW", approvals: { some: { type: roleForScope(input.scope), status: "PENDING" } } }, select: { id: true, approvalCycle: true } });
      const ids = await db.$transaction(async (tx) => (await Promise.all(open.map((request) => queueApprovalCycleNotifications(tx, request.id, request.approvalCycle)))).flat());
      await sendNotifications(ids);
    } catch (error) {
      console.error("Delegated approval notifications could not be queued.", { delegationId: delegation.id, errorName: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  revalidatePath("/delegations"); revalidatePath("/admin/delegations"); revalidatePath("/meine-aufgaben");
}

export async function updateDelegation(id: string, formData: FormData) {
  const actor = await getCurrentUser();
  const existing = await db.approvalDelegation.findUniqueOrThrow({ where: { id }, include: { delegatingUser: { select: { id: true, name: true } }, substituteUser: { select: { id: true, name: true, email: true } } } });
  await assertManageable(actor, existing.delegatingUserId);
  const input = values(formData, existing.delegatingUserId);
  assertScopeManagement(actor, existing.delegatingUserId, input.scope);
  const changed = delegationMateriallyChanged(existing, input);
  if (!changed) return;
  await validateUsersAndOverlap(input, id);
  await db.$transaction(async (tx) => {
    await tx.approvalDelegation.update({ where: { id }, data: { substituteUserId: input.substituteUserId, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt } });
    await tx.auditEvent.create({ data: { userId: actor.id, action: "DELEGATION_UPDATED", entityType: "ApprovalDelegation", entityId: id, summary: `${actor.name} hat eine Stellvertretung geändert.`, details: { substituteUserId: input.substituteUserId, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt } } });
  });
  const newSubstitute = await db.user.findUniqueOrThrow({ where: { id: input.substituteUserId }, select: { id: true, name: true, email: true } });
  await notifyDelegation({ delegationId: id, event: "UPDATED", delegatingUser: existing.delegatingUser, substitute: newSubstitute, scope: input.scope, startsAt: input.startsAt, endsAt: input.endsAt, auditActorId: actor.id });
  if (existing.substituteUserId !== input.substituteUserId) await notifyDelegation({ delegationId: id, event: "REPLACED", delegatingUser: existing.delegatingUser, substitute: existing.substituteUser, scope: existing.scope, startsAt: existing.startsAt, endsAt: existing.endsAt, auditActorId: actor.id });
  revalidatePath("/delegations"); revalidatePath("/admin/delegations"); revalidatePath("/meine-aufgaben");
}

export async function cancelDelegation(id: string) {
  const actor = await getCurrentUser();
  const existing = await db.approvalDelegation.findUniqueOrThrow({ where: { id }, include: { delegatingUser: { select: { id: true, name: true } }, substituteUser: { select: { id: true, name: true, email: true } } } });
  await assertManageable(actor, existing.delegatingUserId);
  if (!existing.enabled) return;
  await db.$transaction(async (tx) => {
    await tx.approvalDelegation.update({ where: { id }, data: { enabled: false } });
    await tx.auditEvent.create({ data: { userId: actor.id, action: "DELEGATION_CANCELLED", entityType: "ApprovalDelegation", entityId: id, summary: `${actor.name} hat eine Stellvertretung beendet.`, details: { delegatingUserId: existing.delegatingUserId, substituteUserId: existing.substituteUserId, scope: existing.scope } } });
  });
  if (shouldNotifyManualCancellation(existing)) await notifyDelegation({ delegationId: id, event: "CANCELLED", delegatingUser: existing.delegatingUser, substitute: existing.substituteUser, scope: existing.scope, startsAt: existing.startsAt, endsAt: existing.endsAt, auditActorId: actor.id });
  revalidatePath("/delegations"); revalidatePath("/admin/delegations"); revalidatePath("/meine-aufgaben");
}
