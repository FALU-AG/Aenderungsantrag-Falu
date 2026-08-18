import type { AuthUser } from "@/modules/auth";

export type EditableRequest = { applicantId: string; status: string };

export function canEditDraft(user: AuthUser, request: EditableRequest) {
  return (request.status === "DRAFT" || request.status === "CHANGES_REQUESTED") && (request.applicantId === user.id || user.roles.includes("ADMINISTRATOR"));
}

export function requireDraftEdit(user: AuthUser, request: EditableRequest) {
  if (!canEditDraft(user, request)) throw new Error("Dieser Änderungsantrag darf nicht bearbeitet werden.");
}
