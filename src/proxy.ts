import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/modules/auth/public-routes";
const SESSION_COOKIE = "falu-session";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers); headers.set("x-falu-pathname", request.nextUrl.pathname);
  if (!isPublicPath(request.nextUrl.pathname) && !request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
