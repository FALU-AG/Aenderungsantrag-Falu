import { NextResponse, type NextRequest } from "next/server";
import { authenticatePortalRequest, DomainError } from "@/modules/auth/portal-guard";
import { portalOrigin, portalLogin } from "@/modules/auth/portal-config";
import { ensureLocalUser } from "@/modules/auth/provisioning";
import { db } from "@/server/db/client";
import { withoutBasePath } from "@/lib/app-paths";
import { arrivedThroughRouter, wrongDoor } from "@/lib/edge-lock";
/** Fail-closed page. The portal link is omitted when its origin is not configured. */
function denied(status: number, portal: string | null) {
  const link = portal ? '<a href="' + portal + '">Zum FALU Admin Portal</a>' : "";
  return new NextResponse('<!doctype html><html lang="de"><title>Kein Zugriff</title><main><h1>Kein Zugriff</h1><p>Du hast aktuell keinen Zugriff auf Änderungsanträge. Wende dich bei Bedarf an einen Administrator.</p>' + link + '</main></html>', { status, headers: { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store" } });
}
export async function proxy(request: NextRequest) {
  const pathname = withoutBasePath(new URL(request.url).pathname);
  // Railway probes the container directly and Resend signs its own webhook, so neither can
  // carry the mark the router sets. Everything else has to come through the router.
  if (!["/api/health", "/api/webhooks/resend"].includes(pathname) && !arrivedThroughRouter(request.headers)) return wrongDoor();
  if ((["GET","HEAD"].includes(request.method) && (pathname.startsWith("/_next/static/") || ["/icon.svg","/api/health"].includes(pathname))) || pathname === "/api/webhooks/resend") return NextResponse.next();
  // Resolve the portal origin before anything can fail, so a misconfigured origin answers with
  // this page instead of throwing while the error path itself tries to build the portal link.
  try { portalOrigin(); }
  catch { return denied(503, null); }
  if (["GET","HEAD"].includes(request.method) && ["/login","/forgot-password","/reset-password","/change-password"].includes(pathname)) return NextResponse.redirect(portalLogin());
  try {
    if (!process.env.FALU_APP_SIGNING_PUBLIC_KEY) throw new DomainError("unavailable",503);
    const claims = await authenticatePortalRequest(request, process.env.FALU_APP_SIGNING_PUBLIC_KEY, portalOrigin(), async (id, expiresAt) => {
      await db.$transaction(async (tx) => { await tx.appAssertionUse.deleteMany({ where: { expiresAt: { lte: new Date() } } }); await tx.appAssertionUse.create({ data: { id, expiresAt } }); });
    });
    if (!await ensureLocalUser(claims.sub)) throw new DomainError("mapping",403);
    if (!["GET","HEAD","OPTIONS"].includes(request.method) && request.headers.get("origin") !== portalOrigin()) throw new DomainError("origin",403);
    const headers = new Headers(request.headers); headers.delete("cookie"); headers.delete("authorization"); headers.set("x-falu-pathname", pathname);
    const response = NextResponse.next({ request: { headers } }); response.headers.set("Cache-Control","no-store"); return response;
  } catch (error) {
    const status = error instanceof DomainError ? error.status : 503;
    // Safe here: the origin was resolved successfully above, so neither call can throw.
    if (status === 401 && ["GET","HEAD"].includes(request.method)) return NextResponse.redirect(portalLogin());
    return denied(status, portalOrigin());
  }
}
