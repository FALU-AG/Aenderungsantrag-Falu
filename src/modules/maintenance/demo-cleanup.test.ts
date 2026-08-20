import { describe, expect, it, vi } from "vitest";
import { cleanupDemoData, DEMO_CHANGE_REQUEST_NUMBERS, PROTECTED_USER_EMAIL } from "./demo-cleanup";

const noRelations = { requests: 0, approvals: 0, finalApprovals: 0, technicalReviews: 0, avorReviews: 0, purchasingReviews: 0, placedPurchaseOrders: 0, assignedTasks: 0, createdTasks: 0, completedTasks: 0, attachments: 0, comments: 0, auditEvents: 0, closedRequests: 0 };

function fixture(options: { nonDemoRelations?: boolean; attachment?: boolean; protectedUser?: boolean } = {}) {
  let present = true;
  const demoUser = options.protectedUser
    ? { id: "sample-max-muster", name: "Protected", email: PROTECTED_USER_EMAIL }
    : { id: "sample-max-muster", name: "Max Muster", email: "max.muster@example.falu.ch" };
  const attachment = { id: "att-demo", changeRequestId: "request-demo", storageProvider: "SUPABASE", storageKey: "change-requests/request-demo/att-demo/demo.pdf" };
  const requests = [{ id: "request-demo", number: DEMO_CHANGE_REQUEST_NUMBERS[0], applicantId: "sample-max-muster", attachments: options.attachment ? [attachment] : [] }];
  const deletion = vi.fn();
  const tx = {
    changeRequestReason: { deleteMany: deletion }, approval: { deleteMany: deletion }, finalApproval: { deleteMany: deletion }, technicalReview: { deleteMany: deletion }, avorImpactReview: { deleteMany: deletion }, purchasingReview: { deleteMany: deletion }, task: { deleteMany: deletion }, attachment: { deleteMany: deletion }, comment: { deleteMany: deletion }, auditEvent: { deleteMany: deletion }, changeRequest: { deleteMany: vi.fn(async () => { present = false; return { count: 1 }; }) }, session: { deleteMany: deletion }, userRole: { deleteMany: deletion }, user: { deleteMany: vi.fn(async () => ({ count: 1 })) },
  };
  const db = {
    user: {
      findMany: vi.fn(async () => present ? [demoUser] : []),
      findUniqueOrThrow: vi.fn(async () => ({ _count: { ...noRelations, ...(options.nonDemoRelations ? { comments: 1 } : {}) } })),
    },
    changeRequest: { findMany: vi.fn(async () => present ? requests : []) },
    task: { count: vi.fn(async () => present ? 2 : 0) }, approval: { count: vi.fn(async () => present ? 3 : 0) }, finalApproval: { count: vi.fn(async () => 1) }, technicalReview: { count: vi.fn(async () => 1) }, avorImpactReview: { count: vi.fn(async () => 1) }, purchasingReview: { count: vi.fn(async () => 1) }, comment: { count: vi.fn(async () => 1) }, auditEvent: { count: vi.fn(async () => 2) },
    machineType: { deleteMany: vi.fn() }, changeReason: { deleteMany: vi.fn() }, role: { deleteMany: vi.fn() }, appSetting: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, tx, deletion, attachment };
}

describe("Demo-Daten-Cleanup", () => {
  it("ändert im Dry Run keine Daten", async () => {
    const { db, deletion } = fixture();
    const result = await cleanupDemoData(db as never, false, vi.fn());
    expect(result.executed).toBe(false);
    expect(deletion).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("entfernt explizite Demo-Anträge, Abhängigkeiten und Demo-Benutzer", async () => {
    const { db, tx, deletion } = fixture();
    const result = await cleanupDemoData(db as never, true, vi.fn());
    expect(result.counts).toMatchObject({ users: 1, changeRequests: 1, tasks: 2, approvals: 3 });
    expect(deletion).toHaveBeenCalled();
    expect(tx.changeRequest.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["request-demo"] } } });
    expect(tx.user.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["sample-max-muster"] } }) }));
  });

  it("bricht ab, falls der geschützte Produktionsbenutzer im Set erscheint", async () => {
    const { db } = fixture({ protectedUser: true });
    await expect(cleanupDemoData(db as never, true, vi.fn())).rejects.toThrow(PROTECTED_USER_EMAIL);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("berührt unbekannte Benutzer und Masterdaten niemals", async () => {
    const { db } = fixture();
    await cleanupDemoData(db as never, true, vi.fn());
    expect(db.machineType.deleteMany).not.toHaveBeenCalled();
    expect(db.changeReason.deleteMany).not.toHaveBeenCalled();
    expect(db.role.deleteMany).not.toHaveBeenCalled();
    expect(db.appSetting.deleteMany).not.toHaveBeenCalled();
  });

  it("überspringt Demo-Benutzer mit Nicht-Demo-Beziehungen", async () => {
    const { db, tx } = fixture({ nonDemoRelations: true });
    const result = await cleanupDemoData(db as never, true, vi.fn());
    expect(result.skippedUsers).toEqual(["max.muster@example.falu.ch"]);
    expect(tx.user.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }));
  });

  it("kann nach erfolgreicher Bereinigung erneut sicher laufen", async () => {
    const { db } = fixture();
    await cleanupDemoData(db as never, true, vi.fn());
    const second = await cleanupDemoData(db as never, true, vi.fn());
    expect(second.empty).toBe(true);
  });

  it("löscht nur das exakt referenzierte Supabase-Objekt", async () => {
    const { db, attachment } = fixture({ attachment: true });
    const remove = vi.fn().mockResolvedValue(undefined);
    await cleanupDemoData(db as never, true, remove);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("SUPABASE", attachment.storageKey);
    expect(remove).not.toHaveBeenCalledWith("SUPABASE", "change-requests/unrelated/file.pdf");
  });

  it("ändert bei einem Storage-Fehler keine Datenbankdaten", async () => {
    const { db } = fixture({ attachment: true });
    await expect(cleanupDemoData(db as never, true, vi.fn().mockRejectedValue(new Error("Storage failed")))).rejects.toThrow("Storage failed");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
