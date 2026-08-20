import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import { hasEffectiveRole } from "@/modules/authorization/roles";

export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireUser() { return getCurrentUser(); }

export async function requireRole(...roles: import("./types").RoleKey[]) {
  const user = await getCurrentUser();
  if (!hasEffectiveRole(user.roles, roles)) {
    throw new Error("Sie besitzen keine Berechtigung für diese Funktion.");
  }
  return user;
}

export { getSessionUser } from "./session";
export type { AuthUser, RoleKey } from "./types";
