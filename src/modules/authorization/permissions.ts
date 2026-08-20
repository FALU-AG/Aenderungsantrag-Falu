import type { RoleKey } from "@/modules/auth";
import { effectiveRoles } from "./roles";

export const PERMISSIONS = [
  "CHANGE_REQUEST_CREATE", "CHANGE_REQUEST_VIEW", "CHANGE_REQUEST_APPROVE_AVOR",
  "CHANGE_REQUEST_APPROVE_TECHNICAL", "TECHNICAL_REVIEW_EDIT", "AVOR_REVIEW_EDIT",
  "PURCHASING_EDIT", "TASK_CREATE", "TASK_UPDATE", "CHANGE_REQUEST_CLOSE", "ADMIN_MANAGE",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Record<RoleKey, readonly Permission[]> = {
  EMPLOYEE: ["CHANGE_REQUEST_CREATE", "CHANGE_REQUEST_VIEW", "TASK_CREATE", "TASK_UPDATE"],
  AVOR: ["CHANGE_REQUEST_APPROVE_AVOR", "AVOR_REVIEW_EDIT", "PURCHASING_EDIT", "CHANGE_REQUEST_CLOSE"],
  TECHNICAL: ["CHANGE_REQUEST_APPROVE_TECHNICAL", "TECHNICAL_REVIEW_EDIT", "CHANGE_REQUEST_CLOSE"],
  ADMINISTRATOR: PERMISSIONS,
};

export function permissionsForRoles(roles: readonly RoleKey[]): Set<Permission> {
  return new Set([...effectiveRoles(roles)].flatMap((role) => rolePermissions[role]));
}

export function hasPermission(user: { roles: readonly RoleKey[] }, permission: Permission): boolean {
  return permissionsForRoles(user.roles).has(permission);
}

export class AuthorizationError extends Error {
  constructor(permission: Permission) {
    super(`Fehlende Berechtigung: ${permission}`);
    this.name = "AuthorizationError";
  }
}

export function requirePermission(user: { roles: readonly RoleKey[] }, permission: Permission): void {
  if (!hasPermission(user, permission)) throw new AuthorizationError(permission);
}
