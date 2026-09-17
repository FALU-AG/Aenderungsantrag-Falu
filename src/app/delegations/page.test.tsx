import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), redirect: vi.fn(), load: vi.fn() }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/delegations/query", () => ({ loadDelegationPageData: mocks.load }));
vi.mock("@/components/delegation-manager", () => ({ DelegationManager: () => null }));
import DelegationsPage from "./page";

describe("self-service delegation page", () => {
  it("redirects an EMPLOYEE-only user before loading delegation data", async () => {
    mocks.user.mockResolvedValue({ id:"employee",roles:["EMPLOYEE"] });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    await expect(DelegationsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("allows an AVOR role holder to load self-service", async () => {
    mocks.redirect.mockReset(); mocks.load.mockResolvedValue({users:[],owners:[],delegations:[]}); mocks.user.mockResolvedValue({id:"avor",roles:["AVOR"]});
    await expect(DelegationsPage()).resolves.toBeTruthy();
    expect(mocks.load).toHaveBeenCalledWith("avor");
  });
});
