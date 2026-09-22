import { db } from "@/server/db/client";
import { centralDirectory } from "./directory";

/**
 * The portal owns identity. The local row owns nothing: it is the anchor that change requests,
 * approvals, reviews, tasks, comments, attachments and audit entries reference, and it carries
 * no rights of its own.
 *
 * It is created on first arrival from signed portal data, so an account that was granted access
 * and a role in the portal simply works. Nobody has to remember a second, manual step here, and
 * a forgotten one can no longer lock a colleague out on their first day.
 *
 * Only the assertion decides whether someone may enter; this runs after that check has passed.
 */
export async function ensureLocalUser(centralId: string) {
  const existing = await db.user.findUnique({ where: { externalId: centralId }, select: { id: true } });
  if (existing) return existing;

  // Name and address come from the signed directory, never from the request. The directory
  // lists only accounts with enabled access, a role and a completed password change, so an
  // account the portal would not vouch for is not created either.
  const entry = (await centralDirectory()).find((user) => user.id === centralId);
  if (!entry) return null;

  try {
    return await db.user.create({ data: { name: entry.name, email: entry.email, externalId: centralId }, select: { id: true } });
  } catch {
    // Either a concurrent first request won the race, or the address already belongs to another
    // row. In the second case we must not guess which person that is - matching on email is
    // exactly what this design avoids - so the request fails closed and an administrator links
    // the rows deliberately.
    return db.user.findUnique({ where: { externalId: centralId }, select: { id: true } });
  }
}
