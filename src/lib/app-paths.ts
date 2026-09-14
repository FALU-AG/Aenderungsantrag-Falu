export const APP_BASE_PATH = "/aenderungsantrag";

export function withBasePath(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) return path;
  return path === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${path}`;
}

export function withoutBasePath(pathname: string): string {
  if (pathname === APP_BASE_PATH) return "/";
  return pathname.startsWith(`${APP_BASE_PATH}/`)
    ? pathname.slice(APP_BASE_PATH.length)
    : pathname;
}

/**
 * APP_BASE_URL is the complete externally visible root URL of this app,
 * including APP_BASE_PATH (for example https://admin.falu.com/aenderungsantrag).
 */
export function absoluteAppUrl(
  path: string,
  appBaseUrl = process.env.APP_BASE_URL ?? `http://localhost:3000${APP_BASE_PATH}`,
): string {
  const root = new URL(appBaseUrl);
  root.search = "";
  root.hash = "";
  root.pathname = root.pathname.replace(/\/+$/, "") || "/";

  const relative = new URL(path, "http://internal.invalid");
  const internalPath = withoutBasePath(relative.pathname);
  const rootPath = root.pathname === "/" ? "" : root.pathname;
  root.pathname = `${rootPath}${internalPath === "/" ? "" : internalPath}` || "/";
  root.search = relative.search;
  root.hash = relative.hash;
  return root.toString();
}
