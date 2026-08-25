"use server";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { createSession, invalidateCurrentSession, invalidateUserSessions } from "./session";
import { getCurrentUser } from ".";
import { hashPassword, validateNewPassword, verifyPassword } from "./password";
export type LoginState = { errors?: { email?: string; password?: string }; message?: string };
export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const errors: NonNullable<LoginState["errors"]> = {};
  if (!email) errors.email = "Bitte geben Sie Ihre E-Mail-Adresse ein.";
  if (!password) errors.password = "Bitte geben Sie Ihr Passwort ein.";
  if (Object.keys(errors).length) return { errors };
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.active || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) return { message: "E-Mail-Adresse oder Passwort ist nicht korrekt." };
  await db.$transaction([db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }), db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })]);
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/change-password" : "/");
}
export async function logout() { await invalidateCurrentSession(); redirect("/login"); }
export type ChangePasswordState = { errors?: { password?: string; passwordConfirmation?: string } };
export async function changeOwnPassword(_: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await getCurrentUser(); const password = String(formData.get("password") ?? ""); const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const errors = validateNewPassword(password, confirmation);
  if (Object.keys(errors).length) return { errors };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await invalidateUserSessions(user.id); await createSession(user.id); redirect("/");
}
