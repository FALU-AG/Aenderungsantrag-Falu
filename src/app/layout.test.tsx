import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font" }) }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div data-shell>{children}</div> }));
import RootLayout from "./layout";

describe("RootLayout", () => {
  beforeEach(() => { mocks.getCurrentUser.mockReset(); mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Erika Beispiel", roles: ["EMPLOYEE"] }); });

  // The proxy answers the public paths itself and sends the former local auth pages to the
  // portal, so anything reaching this layout is already an authenticated application page.
  it("resolves the central identity for every page it renders", async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <p>Intern</p> }));
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce();
    expect(html).toContain("data-shell");
  });

  it("does not render application content without an identity", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect to portal"));
    await expect(RootLayout({ children: <p>Intern</p> })).rejects.toThrow();
  });
});
