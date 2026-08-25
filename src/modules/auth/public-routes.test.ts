import { describe, expect, it } from "vitest";
import { isPublicAuthPath, isPublicPath } from "./public-routes";

describe("öffentliche Authentifizierungsrouten", () => {
  it.each(["/login", "/forgot-password", "/reset-password"])("lässt %s ohne Sitzung zu", (path) => {
    expect(isPublicAuthPath(path)).toBe(true);
    expect(isPublicPath(path)).toBe(true);
  });

  it("lässt den signierten Resend-Webhook öffentlich", () => expect(isPublicPath("/api/webhooks/resend")).toBe(true));
  it.each(["/", "/change-requests", "/admin/users"])("schützt %s", (path) => expect(isPublicPath(path)).toBe(false));
});
