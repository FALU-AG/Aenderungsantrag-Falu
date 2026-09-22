import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), directory: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { user: { findUnique: mocks.findUnique, create: mocks.create } } }));
vi.mock("./directory", () => ({ centralDirectory: mocks.directory }));
import { ensureLocalUser } from "./provisioning";

const entry = { id: "central-A", name: "Erika Beispiel", email: "beispiel@falu.com", roles: ["EMPLOYEE"] as const };

describe("local user provisioning", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset(); mocks.create.mockReset(); mocks.directory.mockReset();
    mocks.directory.mockResolvedValue([entry]);
  });

  it("reuses an existing row without consulting the directory", async () => {
    mocks.findUnique.mockResolvedValue({ id: "local-A" });
    expect(await ensureLocalUser("central-A")).toEqual({ id: "local-A" });
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates the row from signed directory data on first arrival", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue({ id: "local-new" });
    expect(await ensureLocalUser("central-A")).toEqual({ id: "local-new" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: "Erika Beispiel", email: "beispiel@falu.com", externalId: "central-A" },
    }));
  });

  // The directory omits accounts without access, without a role, or with a pending password
  // change. Those must not gain a local row just because an assertion reached us.
  it("creates nothing for an identity the directory does not list", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.directory.mockResolvedValue([]);
    expect(await ensureLocalUser("central-A")).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns the winner when a concurrent first request created the row", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "local-race" });
    mocks.create.mockRejectedValue(new Error("unique constraint"));
    expect(await ensureLocalUser("central-A")).toEqual({ id: "local-race" });
  });

  // Never resolve an address collision by matching on email - that is the ambiguity this
  // design exists to avoid.
  it("fails closed when the address already belongs to another row", async () => {
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockRejectedValue(new Error("unique constraint"));
    expect(await ensureLocalUser("central-A")).toBeNull();
  });
});
