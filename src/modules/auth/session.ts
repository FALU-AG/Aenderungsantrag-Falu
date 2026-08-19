import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import type { AuthUser, RoleKey } from "./types";

export const SESSION_COOKIE = "falu-session";
export const SESSION_DAYS = 7;
const visibleRoles = new Set<RoleKey>(["EMPLOYEE", "AVOR", "TECHNICAL", "ADMINISTRATOR"]);
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
export async function invalidateCurrentSession() {
  const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  store.delete(SESSION_COOKIE);
}
export async function invalidateUserSessions(userId: string) { await db.session.deleteMany({ where: { userId } }); }
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: { include: { roles: { include: { role: true } } } } } });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  const roles = session.user.roles.map(({ role }) => role.key).filter((role): role is RoleKey => visibleRoles.has(role as RoleKey));
  void db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { id: session.user.id, name: session.user.name, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, active: session.user.active, mustChangePassword: session.user.mustChangePassword, roles };
}
