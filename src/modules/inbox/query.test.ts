import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ taskFindMany: vi.fn(), requestFindMany: vi.fn(), build: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { task: { findMany: mocks.taskFindMany }, changeRequest: { findMany: mocks.requestFindMany } } }));
vi.mock("./domain", () => ({ buildPersonalInbox: mocks.build }));

import { loadPersonalInbox } from "./query";

describe("loadPersonalInbox", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.taskFindMany.mockResolvedValue([]); mocks.requestFindMany.mockResolvedValue([]); mocks.build.mockReturnValue([]); });

  it("lädt für normale Mitarbeiter nur eigene Änderungsanträge mit Überarbeitungsbedarf", async () => {
    await loadPersonalInbox({ id: "u1", roles: ["EMPLOYEE"] });
    expect(mocks.requestFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ applicantId: "u1", status: "CHANGES_REQUESTED" }] } }));
    expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", roles: ["EMPLOYEE"] }));
  });

  it("kombiniert für Fachrollen den Workflow-Backlog mit eigenen Überarbeitungen", async () => {
    await loadPersonalInbox({ id: "u2", roles: ["AVOR"] });
    expect(mocks.requestFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ status: { not: "CLOSED" } }, { applicantId: "u2", status: "CHANGES_REQUESTED" }] } }));
  });
});
