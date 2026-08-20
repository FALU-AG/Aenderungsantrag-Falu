import { ROLE_KEYS, type RoleKey } from "@/modules/auth/types";

const employeeInheritingRoles = new Set<RoleKey>([
  "AVOR",
  "TECHNICAL",
  "ADMINISTRATOR",
]);

export function effectiveRoles(roles: readonly RoleKey[]): Set<RoleKey> {
  if (roles.includes("ADMINISTRATOR")) return new Set(ROLE_KEYS);

  const effective = new Set(roles);
  if (roles.some((role) => employeeInheritingRoles.has(role))) {
    effective.add("EMPLOYEE");
  }
  return effective;
}

export function hasEffectiveRole(
  roles: readonly RoleKey[],
  requiredRoles: readonly RoleKey[],
): boolean {
  const effective = effectiveRoles(roles);
  return requiredRoles.some((role) => effective.has(role));
}
