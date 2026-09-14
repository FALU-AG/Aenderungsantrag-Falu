import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/modules/auth/public-routes";
import { withBasePath, withoutBasePath } from "@/lib/app-paths";
const SESSION_COOKIE = "falu-session";
export function proxy(request: NextRequest) {
  const pathname = withoutBasePath(request.nextUrl.pathname);
  const headers = new Headers(request.headers); headers.set("x-falu-pathname", pathname);
  if (!isPublicPath(pathname) && !request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL(withBasePath("/login"), request.url));
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
