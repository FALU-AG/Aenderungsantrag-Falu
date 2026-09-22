import { headers } from "next/headers";
import { db } from "@/server/db/client";
import { verifyAppAssertion } from "./app-assertion";
import { portalOrigin } from "./portal-config";
import type { AuthUser } from "./types";
export async function getSessionUser(): Promise<AuthUser | null> {
  const assertion = (await headers()).get("x-falu-assertion");
  if (!assertion) return null;
  let claims;
  try { claims = verifyAppAssertion(assertion, process.env.FALU_APP_SIGNING_PUBLIC_KEY!, portalOrigin()); } catch { return null; }
  if (!claims.roles.length) return null;
  const local = await db.user.findUnique({ where: { externalId: claims.sub }, select: { id: true, email: true } });
  if (!local) return null;
  return { id: local.id, centralId: claims.sub, name: claims.name, email: local.email, active: true, mustChangePassword: false, roles: claims.roles };
}
