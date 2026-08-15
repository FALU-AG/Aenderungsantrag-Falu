export const ROLE_KEYS = ["EMPLOYEE", "AVOR", "TECHNICAL", "PURCHASING", "ADMINISTRATOR"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: readonly RoleKey[];
};

export interface IdentityProvider {
  getCurrentUser(): Promise<AuthUser>;
}
