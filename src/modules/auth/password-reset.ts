import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db/client";
import { hashPassword } from "./password";
import { PASSWORD_RESET_TTL_MINUTES } from "@/modules/notifications/domain";
import { queueNotification } from "@/modules/notifications/repository";
import { sendNotification } from "@/modules/notifications/service";

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, email: true, name: true, active: true } });
  if (!user?.active) return;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(rawToken);
  const id = await db.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const reset = await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000) } });
    const notification = await queueNotification(tx, { type: "PASSWORD_RESET", idempotencyKey: `password-reset:${reset.id}`, recipientUserId: user.id, recipientEmail: user.email, recipientName: user.name, subject: "Passwort für FALU Change Request zurücksetzen", templateData: {} });
    return notification.id;
  });
  const base = process.env.APP_BASE_URL;
  if (!base) return;
  await sendNotification(id, { sensitiveData: { url: `${new URL(base).origin}/reset-password?token=${encodeURIComponent(rawToken)}` } });
}

export async function consumePasswordReset(token: string, password: string) {
  const tokenHash = hashResetToken(token);
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { select: { active: true } } } });
  if (!reset || !reset.user.active || reset.usedAt || reset.expiresAt <= new Date()) return false;
  const passwordHash = await hashPassword(password);
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash, mustChangePassword: false } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    return true;
  });
  return result;
}
