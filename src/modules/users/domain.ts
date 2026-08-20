import { ROLE_KEYS, type RoleKey } from "@/modules/auth/types";
export const ROLE_LABELS: Record<RoleKey, string> = { EMPLOYEE: "Mitarbeiter", AVOR: "AVOR", TECHNICAL: "Technik", ADMINISTRATOR: "Administrator" };
export const selectableRoles = ROLE_KEYS;
export const USER_BUSINESS_RELATIONS = [
  "requests",
  "approvals",
  "finalApprovals",
  "technicalReviews",
  "avorReviews",
  "purchasingReviews",
  "placedPurchaseOrders",
  "assignedTasks",
  "createdTasks",
  "completedTasks",
  "attachments",
  "comments",
  "auditEvents",
  "closedRequests",
] as const;
export type UserBusinessRelation = (typeof USER_BUSINESS_RELATIONS)[number];
export const USER_BUSINESS_RELATION_SELECT: Record<UserBusinessRelation, true> = {
  requests: true,
  approvals: true,
  finalApprovals: true,
  technicalReviews: true,
  avorReviews: true,
  purchasingReviews: true,
  placedPurchaseOrders: true,
  assignedTasks: true,
  createdTasks: true,
  completedTasks: true,
  attachments: true,
  comments: true,
  auditEvents: true,
  closedRequests: true,
};
export const USER_HAS_BUSINESS_HISTORY_MESSAGE = "Dieser Benutzer kann nicht gelöscht werden, da bereits geschäftliche Aktivitäten mit ihm verknüpft sind. Deaktivieren Sie den Benutzer stattdessen.";

export function hasUserBusinessHistory(counts: Record<UserBusinessRelation, number>): boolean {
  return USER_BUSINESS_RELATIONS.some((relation) => counts[relation] > 0);
}
export type UserDeletionEligibility = {
  deletable: boolean;
  reason?: "SELF" | "LAST_ACTIVE_ADMINISTRATOR" | "BUSINESS_HISTORY";
  message?: string;
  businessCounts: { label: string; count: number }[];
};

export function assessUserDeletion({ actorId, targetId, targetActive, targetRoles, activeAdministratorCount, counts }: {
  actorId: string;
  targetId: string;
  targetActive: boolean;
  targetRoles: readonly string[];
  activeAdministratorCount: number;
  counts: Record<UserBusinessRelation, number>;
}): UserDeletionEligibility {
  const rawBusinessCounts: Array<[string, number]> = [
    ["Erstellte Änderungsanträge", counts.requests],
    ["Abgeschlossene Änderungsanträge", counts.closedRequests],
    ["Freigaben", counts.approvals + counts.finalApprovals],
    ["Technische Prüfungen", counts.technicalReviews],
    ["AVOR-Prüfungen", counts.avorReviews],
    ["Einkaufsprüfungen", counts.purchasingReviews],
    ["Ausgelöste Bestellungen", counts.placedPurchaseOrders],
    ["Erstellte Aufgaben", counts.createdTasks],
    ["Zugewiesene Aufgaben", counts.assignedTasks],
    ["Abgeschlossene Aufgaben", counts.completedTasks],
    ["Anhänge", counts.attachments],
    ["Kommentare", counts.comments],
    ["Audit-Ereignisse", counts.auditEvents],
  ];
  const businessCounts = rawBusinessCounts.filter(([, count]) => count > 0).map(([label, count]) => ({ label, count }));
  if (actorId === targetId) return { deletable: false, reason: "SELF", message: "Das aktuell angemeldete Benutzerkonto kann nicht gelöscht werden.", businessCounts };
  if (targetActive && targetRoles.includes("ADMINISTRATOR") && activeAdministratorCount <= 1) return { deletable: false, reason: "LAST_ACTIVE_ADMINISTRATOR", message: "Der letzte aktive Administrator kann nicht gelöscht werden.", businessCounts };
  if (hasUserBusinessHistory(counts)) return { deletable: false, reason: "BUSINESS_HISTORY", message: "Dieser Benutzer kann nicht gelöscht werden, da geschäftliche Aktivitäten mit ihm verknüpft sind.", businessCounts };
  return { deletable: true, businessCounts: [] };
}
export function normalizeRoles(roles: readonly string[]): RoleKey[] {
  const selected = new Set(roles.filter((role): role is RoleKey => selectableRoles.includes(role as RoleKey)));
  if (["AVOR", "TECHNICAL", "ADMINISTRATOR"].some((role) => selected.has(role as RoleKey))) {
    selected.delete("EMPLOYEE");
  }
  return selectableRoles.filter((role) => selected.has(role));
}
export function roleSummary(roles: readonly string[]): string {
  return normalizeRoles(roles).map((role) => ROLE_LABELS[role]).join(", ");
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const hasAdministratorRole = (roles: readonly string[]) => roles.includes("ADMINISTRATOR");
export function assertAdministratorRemains(activeAdministratorCount: number, targetIsActiveAdministrator: boolean, removesAccess: boolean) {
  if (targetIsActiveAdministrator && removesAccess && activeAdministratorCount <= 1) throw new Error("Es muss mindestens ein aktiver Administrator vorhanden sein.");
}
