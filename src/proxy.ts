import { NextResponse, type NextRequest } from "next/server";
import { authenticatePortalRequest, DomainError } from "@/modules/auth/portal-guard";
import { portalOrigin, portalLogin } from "@/modules/auth/portal-config";
import { db } from "@/server/db/client";
import { withoutBasePath } from "@/lib/app-paths";
export async function proxy(request: NextRequest) {
  const pathname = withoutBasePath(new URL(request.url).pathname);
  if ((["GET","HEAD"].includes(request.method) && (pathname.startsWith("/_next/static/") || ["/icon.svg","/api/health"].includes(pathname))) || pathname === "/api/webhooks/resend") return NextResponse.next();
  if (["GET","HEAD"].includes(request.method) && ["/login","/forgot-password","/reset-password","/change-password"].includes(pathname)) return NextResponse.redirect(portalLogin());
  try {
    if (!process.env.FALU_APP_SIGNING_PUBLIC_KEY) throw new DomainError("unavailable",503);
    const claims = await authenticatePortalRequest(request, process.env.FALU_APP_SIGNING_PUBLIC_KEY, portalOrigin(), async (id, expiresAt) => {
      await db.$transaction(async (tx) => { await tx.appAssertionUse.deleteMany({ where: { expiresAt: { lte: new Date() } } }); await tx.appAssertionUse.create({ data: { id, expiresAt } }); });
    });
    if (!await db.user.findUnique({ where: { externalId: claims.sub }, select: { id: true } })) throw new DomainError("mapping",403);
    if (!["GET","HEAD","OPTIONS"].includes(request.method) && request.headers.get("origin") !== portalOrigin()) throw new DomainError("origin",403);
    const headers = new Headers(request.headers); headers.delete("cookie"); headers.delete("authorization"); headers.set("x-falu-pathname", pathname);
    const response = NextResponse.next({ request: { headers } }); response.headers.set("Cache-Control","no-store"); return response;
  } catch (error) {
    const status = error instanceof DomainError ? error.status : 503;
    if (status === 401 && ["GET","HEAD"].includes(request.method)) return NextResponse.redirect(portalLogin());
    return new NextResponse('<!doctype html><html lang="de"><title>Kein Zugriff</title><main><h1>Kein Zugriff</h1><p>Du hast aktuell keinen Zugriff auf Änderungsanträge. Wende dich bei Bedarf an einen Administrator.</p><a href="' + portalOrigin() + '">Zum FALU Admin Portal</a></main></html>', { status, headers: { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store" } });
  }
}
