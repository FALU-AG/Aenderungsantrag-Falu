import { NextResponse, type NextRequest } from "next/server";
const SESSION_COOKIE = "falu-session";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers); headers.set("x-falu-pathname", request.nextUrl.pathname);
  const publicPath = ["/login", "/forgot-password", "/reset-password", "/api/webhooks/resend"].includes(request.nextUrl.pathname);
  if (!publicPath && !request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg).*)"] };
