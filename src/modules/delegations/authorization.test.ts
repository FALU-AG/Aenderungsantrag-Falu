import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { approvalDelegation: { findFirst: mocks.findFirst } } }));
import { resolveApprovalAuthority } from "./authorization";

describe("delegated approval authorization", () => {
  beforeEach(() => mocks.findFirst.mockReset());
  it("keeps direct approval unchanged", async () => { expect(await resolveApprovalAuthority({ id: "avor", roles: ["AVOR"] }, "AVOR")).toEqual({ allowed: true, delegation: null }); expect(mocks.findFirst).not.toHaveBeenCalled(); });
  it("allows only the delegated approval scope and preserves the represented user", async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: "d1", delegatingUserId: "owner", delegatingUser: { name: "Florian Kaufmann" } }).mockResolvedValueOnce(null);
    expect(await resolveApprovalAuthority({ id: "sub", roles: ["EMPLOYEE"] }, "AVOR")).toMatchObject({ allowed: true, delegation: { id: "d1", delegatingUserId: "owner" } });
    expect(await resolveApprovalAuthority({ id: "sub", roles: ["EMPLOYEE"] }, "TECHNICAL")).toEqual({ allowed: false, delegation: null });
  });
  it("rejects unrelated users or delegations outside the active query", async () => { mocks.findFirst.mockResolvedValue(null); expect((await resolveApprovalAuthority({ id: "other", roles: ["EMPLOYEE"] }, "AVOR")).allowed).toBe(false); expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ enabled: true, startsAt: expect.anything(), endsAt: expect.anything() }) })); });
});
