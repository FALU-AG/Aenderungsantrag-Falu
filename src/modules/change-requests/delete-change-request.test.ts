import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/modules/auth";
import { canDeleteChangeRequest, requireChangeRequestDeletion, type DeletionApproval } from "./authorization";
import { permanentlyDeleteChangeRequest } from "./delete-change-request";

const user = (roles: AuthUser["roles"]): AuthUser => ({ id: "actor", name: "Admin Beispiel", firstName: "Admin", lastName: "Beispiel", email: "admin@falu.ch", active: true, mustChangePassword: false, roles });
const approval = (type: "AVOR" | "TECHNICAL", status: "PENDING" | "REJECTED" | "APPROVED", cycle = 1): DeletionApproval => ({ type, status, cycle });

describe("Löschberechtigung für Änderungsanträge", () => {
  it.each([["EMPLOYEE"], ["AVOR"], ["TECHNICAL"]] as const)("verweigert %s die Löschung", (...roles) => expect(canDeleteChangeRequest(user([...roles]), [])).toBe(false));
  it.each([
    [approval("AVOR", "PENDING"), approval("TECHNICAL", "PENDING")],
    [approval("AVOR", "REJECTED"), approval("TECHNICAL", "PENDING")],
    [approval("AVOR", "PENDING"), approval("TECHNICAL", "REJECTED")],
    [approval("AVOR", "REJECTED"), approval("TECHNICAL", "REJECTED")],
  ])("erlaubt Administration, solange keine Freigabe erfolgt ist", (...approvals) => expect(canDeleteChangeRequest(user(["ADMINISTRATOR"]), approvals)).toBe(true));
  it.each([
    [approval("AVOR", "APPROVED"), approval("TECHNICAL", "PENDING")],
    [approval("AVOR", "PENDING"), approval("TECHNICAL", "APPROVED")],
    [approval("AVOR", "APPROVED"), approval("TECHNICAL", "REJECTED")],
    [approval("AVOR", "REJECTED"), approval("TECHNICAL", "APPROVED")],
    [approval("AVOR", "APPROVED"), approval("TECHNICAL", "APPROVED")],
  ])("sperrt nach jeder AVOR- oder Technikfreigabe", (...approvals) => expect(canDeleteChangeRequest(user(["ADMINISTRATOR"]), approvals)).toBe(false));
  it("berücksichtigt APPROVED aus früheren Zyklen", () => expect(canDeleteChangeRequest(user(["ADMINISTRATOR"]), [approval("AVOR", "APPROVED", 1), approval("AVOR", "REJECTED", 2), approval("TECHNICAL", "PENDING", 2)])).toBe(false));
  it("liefert sichere deutsche Fehler", () => {
    expect(() => requireChangeRequestDeletion(user(["EMPLOYEE"]), [])).toThrow("nicht berechtigt");
    expect(() => requireChangeRequestDeletion(user(["ADMINISTRATOR"]), [approval("AVOR", "APPROVED")])).toThrow("bereits eine Freigabe");
  });
});

function fixture(approvals: DeletionApproval[] = [], attachment = false) {
  const attachments = attachment ? [{ id: "att-1", changeRequestId: "cr-1", storageProvider: "SUPABASE", storageKey: "change-requests/cr-1/att-1/test.pdf" }] : [];
  const request = { id: "cr-1", number: "CR-2026-030", approvals, tasks: [{ id: "task-1" }], attachments };
  const deletion = vi.fn(async () => ({ count: 1 }));
  const auditCreate = vi.fn(async () => ({}));
  const requestDelete = vi.fn(async () => ({ count: 1 }));
  const tx = {
    changeRequest: { findUnique: vi.fn(async () => ({ number: request.number, approvals, tasks: request.tasks, attachments: attachments.map(({ id }) => ({ id })) })), deleteMany: requestDelete },
    emailNotification: { deleteMany: deletion }, changeRequestMachineType: { deleteMany: deletion }, changeRequestReason: { deleteMany: deletion }, approval: { deleteMany: deletion }, finalApproval: { deleteMany: deletion }, technicalReview: { deleteMany: deletion }, avorImpactReview: { deleteMany: deletion }, purchasingReview: { deleteMany: deletion }, task: { deleteMany: deletion }, attachment: { deleteMany: deletion }, comment: { deleteMany: deletion }, auditEvent: { deleteMany: deletion, create: auditCreate },
  };
  const db = {
    changeRequest: { findUnique: vi.fn(async () => request) },
    changeRequestCounter: { update: vi.fn(), deleteMany: vi.fn() }, user: { deleteMany: vi.fn() }, machineType: { deleteMany: vi.fn() }, changeReason: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
  };
  return { db, tx, auditCreate, requestDelete, attachments };
}

describe("permanente Antragslöschung", () => {
  it("löscht alle antragseigenen Daten und bewahrt ein FK-freies Admin-Audit", async () => {
    const { db, auditCreate, requestDelete } = fixture([approval("AVOR", "REJECTED"), approval("TECHNICAL", "PENDING")]);
    await permanentlyDeleteChangeRequest(db as never, user(["ADMINISTRATOR"]), "cr-1", vi.fn());
    expect(requestDelete).toHaveBeenCalledWith({ where: { id: "cr-1", number: "CR-2026-030", approvals: { none: { status: "APPROVED" } } } });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ changeRequestId: null, userId: "actor", action: "CHANGE_REQUEST_DELETED", details: expect.objectContaining({ deletedRequestNumber: "CR-2026-030" }) }) });
    expect(db.user.deleteMany).not.toHaveBeenCalled(); expect(db.machineType.deleteMany).not.toHaveBeenCalled(); expect(db.changeReason.deleteMany).not.toHaveBeenCalled();
    expect(db.changeRequestCounter.update).not.toHaveBeenCalled(); expect(db.changeRequestCounter.deleteMany).not.toHaveBeenCalled();
  });
  it("blockiert einen direkten Aufruf durch Nicht-Administratoren vor Storage und Transaktion", async () => {
    const { db } = fixture(); const remove = vi.fn();
    await expect(permanentlyDeleteChangeRequest(db as never, user(["EMPLOYEE"]), "cr-1", remove)).rejects.toThrow("nicht berechtigt");
    expect(remove).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("blockiert historische Freigaben vor jeder Mutation", async () => {
    const { db } = fixture([approval("AVOR", "APPROVED", 1), approval("AVOR", "REJECTED", 2)]); const remove = vi.fn();
    await expect(permanentlyDeleteChangeRequest(db as never, user(["ADMINISTRATOR"]), "cr-1", remove)).rejects.toThrow("bereits eine Freigabe");
    expect(remove).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("löscht nur den exakten validierten Storage-Pfad vor der DB-Transaktion", async () => {
    const { db, attachments } = fixture([], true); const remove = vi.fn().mockResolvedValue(undefined);
    await permanentlyDeleteChangeRequest(db as never, user(["ADMINISTRATOR"]), "cr-1", remove);
    expect(remove).toHaveBeenCalledWith("SUPABASE", attachments[0].storageKey);
  });
  it("beginnt bei Storage-Fehlern keine DB-Transaktion", async () => {
    const { db } = fixture([], true);
    await expect(permanentlyDeleteChangeRequest(db as never, user(["ADMINISTRATOR"]), "cr-1", vi.fn().mockRejectedValue(new Error("Storage failed")))).rejects.toThrow("Storage failed");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
