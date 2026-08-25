import type { AuthUser } from "@/modules/auth";

export type EditableRequest = { applicantId: string; status: string };

export function canEditDraft(user: AuthUser, request: EditableRequest) {
  return (request.status === "DRAFT" || request.status === "CHANGES_REQUESTED") && (request.applicantId === user.id || user.roles.includes("ADMINISTRATOR"));
}

export function requireDraftEdit(user: AuthUser, request: EditableRequest) {
  if (!canEditDraft(user, request)) throw new Error("Dieser Änderungsantrag darf nicht bearbeitet werden.");
}

export type DeletionApproval = { type: "AVOR" | "TECHNICAL"; status: string; cycle?: number };

export function canDeleteChangeRequest(user: Pick<AuthUser, "roles">, approvals: readonly DeletionApproval[]) {
  return user.roles.includes("ADMINISTRATOR") && !approvals.some((approval) => approval.status === "APPROVED");
}

export function requireChangeRequestDeletion(user: Pick<AuthUser, "roles">, approvals: readonly DeletionApproval[]) {
  if (!user.roles.includes("ADMINISTRATOR")) throw new Error("Sie sind nicht berechtigt, Änderungsanträge zu löschen.");
  if (!canDeleteChangeRequest(user, approvals)) throw new Error("Dieser Änderungsantrag kann nicht mehr gelöscht werden, da bereits eine Freigabe erfolgt ist.");
}
