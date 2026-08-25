import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/", getCurrentUser: vi.fn() }));
vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font" }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-falu-pathname": mocks.pathname }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div data-shell>{children}</div> }));
import RootLayout from "./layout";

describe("RootLayout public routes", () => {
  beforeEach(() => { mocks.getCurrentUser.mockReset(); mocks.getCurrentUser.mockResolvedValue({ id: "u1", mustChangePassword: false }); });
  it.each(["/login", "/forgot-password", "/reset-password"])("rendert %s ohne Session-Abfrage und ohne AppShell", async (pathname) => {
    mocks.pathname = pathname;
    const html = renderToStaticMarkup(await RootLayout({ children: <p>Recovery</p> }));
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(html).not.toContain("data-shell");
  });
  it("fordert für eine geschützte Route weiterhin den aktuellen Benutzer an", async () => {
    mocks.pathname = "/change-requests";
    const html = renderToStaticMarkup(await RootLayout({ children: <p>Intern</p> }));
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce();
    expect(html).toContain("data-shell");
  });
});
