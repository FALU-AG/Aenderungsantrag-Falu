export function portalOrigin() {
  const value = process.env.FALU_PORTAL_ORIGIN ?? "https://admin.falu.com";
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1"].includes(url.hostname)))) throw new Error("Invalid portal origin");
  return value;
}
export function portalLogin() { return portalOrigin() + "/login?returnTo=%2Faenderungsantrag"; }
