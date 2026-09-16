import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks, client } = vi.hoisted(() => {
  const mocks = { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), auditCreate: vi.fn(), queueBroadcast: vi.fn(), send: vi.fn() };
  const client: Record<string, unknown> = {
    changeRequest: { findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany, findMany: mocks.findMany },
    auditEvent: { create: mocks.auditCreate },
  };
  client.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(client));
  return { mocks, client };
});
vi.mock("@/server/db/client", () => ({ db: client }));
vi.mock("./workflow", () => ({ queueCompletedRequestBroadcast: mocks.queueBroadcast }));
vi.mock("./service-core", () => ({ sendNotifications: mocks.send }));

import { completionSummaryRequest, generateAndBroadcastCompletionSummary, runCompletionCommunicationAfterClosure } from "./completion-summary";

const source = {
  status: "CLOSED",
  number: "CR-2026-041",
  title: "Optimierung Abstreifer CB1",
  applicantName: "Florian Kaufmann",
  description: "Verschleiss reduzieren",
  otherReasonText: null,
  finalComment: null,
  closingRemarks: "Abstreifer ersetzt und Dokumentation angepasst.",
  closedAt: new Date("2026-09-16T10:00:00Z"),
  machineTypes: [{ machineType: { code: "CB1" } }],
  reasons: [{ changeReason: { label: "Qualitätsverbesserung" } }],
  technicalReview: { implementationNotes: "Neue Ausführung eingebaut.", nextSteps: "Zeichnung aktualisiert." },
  avorImpactReview: null,
  purchasingReview: null,
  tasks: [{ title: "Zeichnung anpassen", description: "Revision erhöhen" }],
  finalApprovals: [{ type: "TECHNICAL" as const, comment: "Technisch abgeschlossen." }],
};

describe("automatic completion summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(source);
    mocks.update.mockResolvedValue({});
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.queueBroadcast.mockResolvedValue(["notification-1", "notification-2"]);
    mocks.send.mockResolvedValue(undefined);
  });

  it("generates, stores, audits, and broadcasts only after CLOSED", async () => {
    const provider = { formulate: vi.fn().mockResolvedValue("Der Abstreifer der CB1 wurde ersetzt. Die Dokumentation wurde angepasst.") };
    await expect(generateAndBroadcastCompletionSummary("cr-1", { provider })).resolves.toEqual({ status: "completed", sent: 2 });
    expect(provider.formulate).toHaveBeenCalledWith(expect.objectContaining({ notes: expect.stringContaining("Abschlussnotizen: Abstreifer ersetzt"), context: expect.stringContaining("Erfinde nichts") }));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "CLOSED", finalComment: null }), data: { finalComment: "Der Abstreifer der CB1 wurde ersetzt. Die Dokumentation wurde angepasst." } }));
    expect(mocks.queueBroadcast).toHaveBeenCalledWith(client, "cr-1");
    expect(mocks.send).toHaveBeenCalledWith(["notification-1", "notification-2"]);
  });

  it.each(["DRAFT", "UNDER_REVIEW", "FINAL_REVIEW", "APPROVED_FOR_IMPLEMENTATION"])("does not generate in intermediate state %s", async (status) => {
    mocks.findUnique.mockResolvedValue({ ...source, status });
    const provider = { formulate: vi.fn() };
    await expect(generateAndBroadcastCompletionSummary("cr-1", { provider })).resolves.toEqual({ status: "skipped", sent: 0 });
    expect(provider.formulate).not.toHaveBeenCalled();
    expect(mocks.queueBroadcast).not.toHaveBeenCalled();
  });

  it("keeps CLOSED, records failure, and sends no misleading message when AI fails", async () => {
    const provider = { formulate: vi.fn().mockRejectedValue(new Error("provider unavailable")) };
    await expect(generateAndBroadcastCompletionSummary("cr-1", { provider })).resolves.toEqual({ status: "failed", sent: 0 });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "AI_COMPLETION_SUMMARY_FAILED", details: { error: "provider unavailable" } }) }));
    expect(mocks.queueBroadcast).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("recovers on a later retry after an AI failure", async () => {
    await generateAndBroadcastCompletionSummary("cr-1", { provider: { formulate: vi.fn().mockRejectedValue(new Error("temporary")) } });
    mocks.queueBroadcast.mockResolvedValue(["notification-1"]);
    const retryProvider = { formulate: vi.fn().mockResolvedValue("Automatisch erzeugte Abschlusszusammenfassung.") };
    await expect(generateAndBroadcastCompletionSummary("cr-1", { provider: retryProvider })).resolves.toEqual({ status: "completed", sent: 1 });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { finalComment: "Automatisch erzeugte Abschlusszusammenfassung." } }));
    expect(mocks.send).toHaveBeenCalledWith(["notification-1"]);
  });

  it("reuses a stored summary so retry cannot generate a different text", async () => {
    mocks.findUnique.mockResolvedValue({ ...source, finalComment: "Bereits gespeicherte Zusammenfassung." });
    const provider = { formulate: vi.fn() };
    await generateAndBroadcastCompletionSummary("cr-1", { provider });
    expect(provider.formulate).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.queueBroadcast).toHaveBeenCalledOnce();
  });

  it("builds the prompt exclusively from stored request data", () => {
    const request = completionSummaryRequest(source);
    expect(request.notes).toContain("CR-2026-041");
    expect(request.notes).toContain("CB1");
    expect(request.notes).toContain("Qualitätsverbesserung");
    expect(request.notes).toContain("Zeichnung anpassen");
    expect(request.notes).not.toContain("Internet");
  });

  it("runs automatically after a successful final close and not for an intermediate approval", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await runCompletionCommunicationAfterClosure("cr-1", true, run);
    await runCompletionCommunicationAfterClosure("cr-2", false, run);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("cr-1");
  });

  it("does not propagate an AI or delivery failure back into the completed workflow", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runCompletionCommunicationAfterClosure("cr-1", true, vi.fn().mockRejectedValue(new Error("failed")))).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
