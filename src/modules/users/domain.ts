import { ROLE_KEYS, type RoleKey } from "@/modules/auth/types";
export const ROLE_LABELS: Record<RoleKey, string> = { EMPLOYEE: "Mitarbeiter", AVOR: "AVOR", TECHNICAL: "Technik", ADMINISTRATOR: "Administrator" };
export const selectableRoles = ROLE_KEYS;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const hasAdministratorRole = (roles: readonly string[]) => roles.includes("ADMINISTRATOR");
export function assertAdministratorRemains(activeAdministratorCount: number, targetIsActiveAdministrator: boolean, removesAccess: boolean) {
  if (targetIsActiveAdministrator && removesAccess && activeAdministratorCount <= 1) throw new Error("Es muss mindestens ein aktiver Administrator vorhanden sein.");
}
