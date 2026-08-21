import { describe, expect, it } from "vitest";
import { AuthorizationError, hasPermission, permissionsForRoles, requirePermission, PERMISSIONS } from "./permissions";

describe("Berechtigungen", () => {
  it("erlaubt AVOR die separate AVOR-Freigabe und den Abschluss", () => {
    const user = { roles: ["AVOR"] as const };
    expect(hasPermission(user, "CHANGE_REQUEST_APPROVE_AVOR")).toBe(true);
    expect(hasPermission(user, "CHANGE_REQUEST_CLOSE")).toBe(true);
    expect(hasPermission(user, "CHANGE_REQUEST_APPROVE_TECHNICAL")).toBe(false);
  });

  it("gewährt Mitarbeitern die Basisberechtigungen", () => {
    expect(hasPermission({ roles: ["EMPLOYEE"] }, "CHANGE_REQUEST_CREATE")).toBe(true);
    expect(hasPermission({ roles: ["EMPLOYEE"] }, "TASK_UPDATE")).toBe(true);
    expect(hasPermission({ roles: ["EMPLOYEE"] }, "TASK_CREATE")).toBe(false);
  });

  it("vererbt AVOR und Technik die Basisberechtigungen ohne Mitarbeiterrolle", () => {
    expect(hasPermission({ roles: ["AVOR"] }, "CHANGE_REQUEST_CREATE")).toBe(true);
    expect(hasPermission({ roles: ["TECHNICAL"] }, "CHANGE_REQUEST_CREATE")).toBe(true);
    expect(hasPermission({ roles: ["AVOR"] }, "TASK_CREATE")).toBe(true);
    expect(hasPermission({ roles: ["TECHNICAL"] }, "TASK_CREATE")).toBe(true);
  });

  it("behandelt redundante Mitarbeiterrollen berechtigungsseitig identisch", () => {
    expect(permissionsForRoles(["AVOR", "EMPLOYEE"])).toEqual(permissionsForRoles(["AVOR"]));
    expect(permissionsForRoles(["TECHNICAL", "EMPLOYEE"])).toEqual(permissionsForRoles(["TECHNICAL"]));
  });

  it("kombiniert AVOR- und Technikberechtigungen", () => {
    const permissions = permissionsForRoles(["AVOR", "TECHNICAL"]);
    expect(permissions.has("CHANGE_REQUEST_APPROVE_AVOR")).toBe(true);
    expect(permissions.has("CHANGE_REQUEST_APPROVE_TECHNICAL")).toBe(true);
    expect(permissions.has("CHANGE_REQUEST_CREATE")).toBe(true);
  });

  it("gewährt Administratoren alle expliziten Berechtigungen", () => {
    expect(permissionsForRoles(["ADMINISTRATOR"])).toEqual(new Set(PERMISSIONS));
  });

  it("erzwingt Berechtigungen serverseitig", () => {
    expect(() => requirePermission({ roles: ["EMPLOYEE"] }, "ADMIN_MANAGE")).toThrow(AuthorizationError);
  });
});
