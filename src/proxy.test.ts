import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("Authentifizierungs-Proxy", () => {
  it.each(["/login", "/forgot-password", "/reset-password", "/api/webhooks/resend"])("lässt %s ohne Sitzung passieren", (path) => {
    const response = proxy(new NextRequest(`https://app.falu.ch${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
  it("leitet eine geschützte Route ohne Sitzung zur Anmeldung", () => {
    const response = proxy(new NextRequest("https://app.falu.ch/change-requests"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.falu.ch/login");
  });
});
