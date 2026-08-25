export const PUBLIC_AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"] as const;
export const PUBLIC_API_PATHS = ["/api/webhooks/resend"] as const;

export function isPublicAuthPath(pathname: string) {
  return (PUBLIC_AUTH_PATHS as readonly string[]).includes(pathname);
}

export function isPublicPath(pathname: string) {
  return isPublicAuthPath(pathname) || (PUBLIC_API_PATHS as readonly string[]).includes(pathname);
}
