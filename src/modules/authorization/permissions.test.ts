import { describe, expect, it } from "vitest";
import { AuthorizationError, hasPermission, requirePermission } from "./permissions";

describe("Berechtigungen", () => {
  it("erlaubt AVOR die separate AVOR-Freigabe und den Abschluss", () => {
    const user = { roles: ["EMPLOYEE", "AVOR"] as const };
    expect(hasPermission(user, "CHANGE_REQUEST_APPROVE_AVOR")).toBe(true);
    expect(hasPermission(user, "CHANGE_REQUEST_CLOSE")).toBe(true);
    expect(hasPermission(user, "CHANGE_REQUEST_APPROVE_TECHNICAL")).toBe(false);
  });

  it("gewährt Administratoren alle expliziten Berechtigungen", () => {
    expect(hasPermission({ roles: ["ADMINISTRATOR"] }, "ADMIN_MANAGE")).toBe(true);
    expect(hasPermission({ roles: ["ADMINISTRATOR"] }, "PURCHASING_EDIT")).toBe(true);
  });

  it("erzwingt Berechtigungen serverseitig", () => {
    expect(() => requirePermission({ roles: ["EMPLOYEE"] }, "ADMIN_MANAGE")).toThrow(AuthorizationError);
  });
});
