import { describe, expect, it } from "vitest";
import { absoluteAppUrl, APP_BASE_PATH, withBasePath, withoutBasePath } from "./app-paths";

describe("application base path", () => {
  it("prefixes browser-controlled application and API URLs", () => {
    const paths = [
      "/login", "/", "/change-requests", "/change-requests/cr-1",
      "/change-requests/cr-1/edit", "/meine-aufgaben", "/admin/users",
      "/forgot-password", "/reset-password?token=secret",
      "/change-requests/cr-1/attachments/att-1", "/api/webhooks/resend",
    ];
    for (const path of paths) expect(withBasePath(path)).toBe(`${APP_BASE_PATH}${path === "/" ? "" : path}`);
  });

  it("never duplicates the base path", () => {
    expect(withBasePath(`${APP_BASE_PATH}/login`)).toBe(`${APP_BASE_PATH}/login`);
    expect(withBasePath(APP_BASE_PATH)).toBe(APP_BASE_PATH);
  });

  it("normalizes proxy paths with or without the mount prefix", () => {
    expect(withoutBasePath(`${APP_BASE_PATH}/login`)).toBe("/login");
    expect(withoutBasePath("/login")).toBe("/login");
    expect(withoutBasePath(APP_BASE_PATH)).toBe("/");
  });

  it("builds complete email URLs from APP_BASE_URL without duplication", () => {
    const root = "https://admin.falu.com/aenderungsantrag/";
    expect(absoluteAppUrl("/change-requests/cr-1?tab=Aufgaben#task-1", root)).toBe(
      "https://admin.falu.com/aenderungsantrag/change-requests/cr-1?tab=Aufgaben#task-1",
    );
    expect(absoluteAppUrl("/aenderungsantrag/reset-password?token=secret", root)).toBe(
      "https://admin.falu.com/aenderungsantrag/reset-password?token=secret",
    );
  });
});
