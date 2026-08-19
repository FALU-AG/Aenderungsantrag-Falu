export const ROLE_KEYS = ["EMPLOYEE", "AVOR", "TECHNICAL", "ADMINISTRATOR"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export type AuthUser = {
  id: string; name: string; firstName?: string; lastName?: string; email: string;
  active?: boolean; mustChangePassword?: boolean; roles: readonly RoleKey[];
};
