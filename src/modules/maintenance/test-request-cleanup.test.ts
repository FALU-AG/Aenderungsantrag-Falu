import { describe, expect, it, vi } from "vitest";
import { deleteTestChangeRequests, formatTestRequestCleanup } from "./test-request-cleanup";

const TARGETS = ["CR-2026-028", "CR-2026-029"] as const;
const relationNames = ["changeRequestMachineType", "changeRequestReason", "approval", "finalApproval", "technicalReview", "avorImpactReview", "purchasingReview", "task", "attachment", "comment", "auditEvent", "emailNotification"] as const;

function fixture(options: { missing?: boolean; attachment?: boolean; storageProvider?: "SUPABASE" | "LOCAL"; numbers?: readonly string[] } = {}) {
  const numbers = options.numbers ?? TARGETS;
  const attachments = options.attachment ? [{ id: "att-28", changeRequestId: "req-28", storageProvider: options.storageProvider ?? "SUPABASE", storageKey: options.storageProvider === "LOCAL" ? "local-test.pdf" : "change-requests/req-28/att-28/test.pdf" }] : [];
  const requests = numbers.map((number, index) => ({
    id: `req-${index === 0 ? 28 : 29}`,
    number,
    tasks: [{ id: `task-${index === 0 ? 28 : 29}` }],
    attachments: index === 0 ? attachments : [],
  }));
  const order: string[] = [];
  const changeRequestDeletion = vi.fn(async () => { order.push("changeRequest"); return { count: numbers.length }; });
  const tx = Object.fromEntries(relationNames.map((name) => [name, { deleteMany: vi.fn(async () => { order.push(name); return { count: 1 }; }) }])) as Record<(typeof relationNames)[number], { deleteMany: ReturnType<typeof vi.fn> }>;
  Object.assign(tx, {
    changeRequest: {
      findMany: vi.fn(async () => requests.map(({ id, number, attachments: items }) => ({ id, number, attachments: items.map(({ id: attachmentId }) => ({ id: attachmentId })) }))),
      deleteMany: changeRequestDeletion,
    },
  });
  let changeRequestCountCall = 0;
  const counted = Object.fromEntries(relationNames.map((name) => [name, { count: vi.fn(async () => name === "emailNotification" ? 2 : 1) }])) as Record<string, { count: ReturnType<typeof vi.fn> }>;
  const db = {
    ...counted,
    changeRequest: {
      findMany: vi.fn(async () => options.missing ? requests.slice(0, 1) : requests),
      count: vi.fn(async () => [12, 0, 12][changeRequestCountCall++] ?? 12),
    },
    user: { count: vi.fn(async () => 8) },
    changeRequestCounter: { update: vi.fn(), deleteMany: vi.fn() },
    machineType: { deleteMany: vi.fn() }, changeReason: { deleteMany: vi.fn() }, role: { deleteMany: vi.fn() }, appSetting: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
  };
  return { db, tx, order, attachments, changeRequestDeletion, numbers };
}

describe("gezielte Testantrag-Bereinigung", () => {
  it("zeigt standardmässig einen vollständigen Dry Run ohne Mutation", async () => {
    const { db, changeRequestDeletion } = fixture({ attachment: true });
    const remove = vi.fn();
    const result = await deleteTestChangeRequests(db as never, TARGETS, false, remove);
    expect(result.requests.map(({ number }) => number)).toEqual([...TARGETS]);
    expect(result.requests[0].counts).toMatchObject({ changeRequest: 1, tasks: 1, attachments: 1, notifications: 2 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(changeRequestDeletion).not.toHaveBeenCalled();
    expect(formatTestRequestCleanup(result)).toContain("Dry Run – keine Daten wurden geändert.");
  });

  it("bricht ab, wenn nicht alle angeforderten Nummern vorhanden sind", async () => {
    const { db } = fixture({ missing: true });
    await expect(deleteTestChangeRequests(db as never, TARGETS)).rejects.toThrow("alle und ausschliesslich");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("löscht ausschliesslich exakte Storage-Objekte und danach alle Kindtabellen in einer Transaktion", async () => {
    const { db, tx, order, attachments } = fixture({ attachment: true });
    const remove = vi.fn().mockResolvedValue(undefined);
    const result = await deleteTestChangeRequests(db as never, TARGETS, true, remove);
    expect(result.executed).toBe(true);
    expect(remove).toHaveBeenCalledExactlyOnceWith("SUPABASE", attachments[0].storageKey);
    expect(order.at(-1)).toBe("changeRequest");
    expect(order).toEqual(expect.arrayContaining([...relationNames, "changeRequest"]));
    expect(tx.emailNotification.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ changeRequestId: { in: ["req-28", "req-29"] } }, { taskId: { in: ["task-28", "task-29"] } }] } });
  });

  it("mutiert die Datenbank nicht, wenn die Storage-Bereinigung fehlschlägt", async () => {
    const { db } = fixture({ attachment: true });
    await expect(deleteTestChangeRequests(db as never, TARGETS, true, vi.fn().mockRejectedValue(new Error("Storage unavailable")))).rejects.toThrow("Storage unavailable");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("berührt Benutzer, Masterdaten und Nummernkreis nicht", async () => {
    const { db } = fixture();
    await deleteTestChangeRequests(db as never, TARGETS, true, vi.fn());
    expect(db.user.count).toHaveBeenCalledTimes(2);
    expect(db.machineType.deleteMany).not.toHaveBeenCalled();
    expect(db.changeReason.deleteMany).not.toHaveBeenCalled();
    expect(db.role.deleteMany).not.toHaveBeenCalled();
    expect(db.appSetting.deleteMany).not.toHaveBeenCalled();
    expect(db.changeRequestCounter.update).not.toHaveBeenCalled();
    expect(db.changeRequestCounter.deleteMany).not.toHaveBeenCalled();
  });

  it("weist unsichere Supabase-Pfade bereits vor Storage- oder DB-Mutation ab", async () => {
    const { db } = fixture({ attachment: true });
    db.changeRequest.findMany.mockResolvedValueOnce([
      { id: "req-28", number: TARGETS[0], tasks: [], attachments: [{ id: "att-28", changeRequestId: "req-28", storageProvider: "SUPABASE", storageKey: "change-requests/unrelated/file.pdf" }] },
      { id: "req-29", number: TARGETS[1], tasks: [], attachments: [] },
    ]);
    const remove = vi.fn();
    await expect(deleteTestChangeRequests(db as never, TARGETS, true, remove)).rejects.toThrow("unsicherer Storage-Pfad");
    expect(remove).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("löscht auch einen einzelnen benannten Antrag", async () => {
    const single = ["CR-2026-001"] as const;
    const { db, order } = fixture({ numbers: single });
    const result = await deleteTestChangeRequests(db as never, single, true, vi.fn());
    expect(result.executed).toBe(true);
    expect(result.requests.map(({ number }) => number)).toEqual([...single]);
    expect(order.at(-1)).toBe("changeRequest");
  });

  it("verweigert eine leere, doppelte oder unsinnige Nummernliste, bevor die Datenbank befragt wird", async () => {
    for (const [numbers, message] of [
      [[], "keine Antragsnummer"],
      [["CR-2026-001", "CR-2026-001"], "doppelt"],
      [["CR-2026-1"], "Ungültige Antragsnummer"],
      [["DROP TABLE"], "Ungültige Antragsnummer"],
    ] as const) {
      const { db } = fixture();
      await expect(deleteTestChangeRequests(db as never, numbers, true, vi.fn())).rejects.toThrow(message);
      expect(db.changeRequest.findMany).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    }
  });
});
