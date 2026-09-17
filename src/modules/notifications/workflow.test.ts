import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ activeRoleRecipients: vi.fn(), requestRecipient: vi.fn(), queue: vi.fn() }));
vi.mock("./recipients", () => ({ activeRoleRecipients: mocks.activeRoleRecipients, requestRecipient: mocks.requestRecipient }));
vi.mock("./repository", () => ({ queueNotification: mocks.queue }));
import { queueApprovalCycleNotifications, queueCompletedRequestBroadcast, queueRequestNotification, queueTaskAssignmentNotification } from "./workflow";

const request = { id: "cr-1", number: "CR-2026-001", title: "Riemenspanner", description: "Spannung verbessert", status: "UNDER_REVIEW", applicantName: "Anna Antrag", approvalCycle: 1, finalReviewCycle: 1, finalComment: null, closedAt: null, machineTypes: [{ machineType: { code: "M1" } }] };
const tx = {
  changeRequest: { findUniqueOrThrow: vi.fn().mockResolvedValue(request) },
  user: { findMany: vi.fn() },
  task: { findUniqueOrThrow: vi.fn() },
  approvalDelegation: { findMany: vi.fn() },
};

describe("workflow notification orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "https://admin.falu.com/aenderungsantrag";
    mocks.queue.mockImplementation(async (_tx, input) => ({ id: input.idempotencyKey }));
    mocks.activeRoleRecipients.mockImplementation(async (_tx, role) => role === "AVOR" ? [{ id: "avor", email: "avor@falu.ch", name: "Anna AVOR" }] : [{ id: "tech", email: "tech@falu.ch", name: "Theo Technik" }]);
    mocks.requestRecipient.mockResolvedValue({ id: "applicant", email: "applicant@falu.ch", name: "Anna Antrag" });
    tx.approvalDelegation.findMany.mockResolvedValue([]);
  });

  it("notifies an active substitute without duplicating a direct recipient", async () => {
    tx.approvalDelegation.findMany.mockImplementation(async ({ where }) => where.scope === "AVOR_APPROVAL" ? [{ substituteUser: { id: "sub", email: "sub@falu.ch", name: "Stellvertreter" }, delegatingUser: { name: "Anna AVOR" } }] : []);
    await queueApprovalCycleNotifications(tx as never, "cr-1", 1);
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ recipientEmail: "sub@falu.ch", templateData: expect.objectContaining({ detail: expect.stringContaining("Stellvertretung für Anna AVOR") }) }));
  });

  it("queues separate AVOR and Technical recipients with correct links", async () => {
    expect(await queueApprovalCycleNotifications(tx as never, "cr-1", 1)).toHaveLength(2);
    expect(mocks.activeRoleRecipients).toHaveBeenNthCalledWith(1, tx, "AVOR");
    expect(mocks.activeRoleRecipients).toHaveBeenNthCalledWith(2, tx, "TECHNICAL");
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ type: "APPROVAL_REQUIRED_AVOR", recipientEmail: "avor@falu.ch", templateData: expect.objectContaining({ url: "https://admin.falu.com/aenderungsantrag/change-requests/cr-1?tab=Freigaben" }) }));
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ type: "APPROVAL_REQUIRED_TECHNICAL", recipientEmail: "tech@falu.ch" }));
  });

  it.each(["REQUEST_CHANGES_REQUIRED", "REQUEST_CLOSED"] as const)("notifies the applicant for %s", async (type) => {
    await queueRequestNotification(tx as never, "cr-1", type, `event:${type}`, "Bitte prüfen");
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ type, recipientEmail: "applicant@falu.ch", templateData: expect.objectContaining({ url: "https://admin.falu.com/aenderungsantrag/change-requests/cr-1" }) }));
  });

  it("notifies the responsible user about task assignment and reassignment", async () => {
    tx.task.findUniqueOrThrow.mockResolvedValue({ id: "task-1", title: "Zeichnung", priority: "HIGH", dueDate: null, responsibleUser: { id: "user-1", email: "user@falu.ch", name: "User", active: true }, changeRequest: { id: "cr-1", number: "CR-2026-001", title: "Antrag" } });
    await queueTaskAssignmentNotification(tx as never, "task-1", "assigned:2026-09-15");
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ type: "TASK_ASSIGNED", recipientEmail: "user@falu.ch", subject: expect.stringContaining("neu zugewiesen"), templateData: expect.objectContaining({ url: "https://admin.falu.com/aenderungsantrag/change-requests/cr-1?tab=Aufgaben#task-task-1" }) }));
  });

  it("broadcasts a genuine completion once to every active user with the stored summary", async () => {
    tx.changeRequest.findUniqueOrThrow.mockResolvedValue({ ...request, status: "CLOSED", finalComment: "Neue Halterung montiert und getestet.", closedAt: new Date("2026-09-16T10:00:00Z") });
    tx.user.findMany.mockResolvedValue([{ id: "u1", email: "u1@falu.ch", name: "Aktiv" }, { id: "u2", email: "u2@falu.ch", name: "Auch aktiv" }]);
    expect(await queueCompletedRequestBroadcast(tx as never, "cr-1")).toHaveLength(2);
    expect(tx.user.findMany).toHaveBeenCalledWith({ where: { active: true }, select: { id: true, email: true, name: true } });
    expect(mocks.queue).toHaveBeenCalledWith(tx, expect.objectContaining({ idempotencyKey: "completed-broadcast:cr-1:u1", templateData: expect.objectContaining({ completionSummary: "Neue Halterung montiert und getestet.", detail: "Spannung verbessert" }) }));
    await queueCompletedRequestBroadcast(tx as never, "cr-1");
    expect(new Set(mocks.queue.mock.calls.map((call) => call[1].idempotencyKey))).toEqual(new Set(["completed-broadcast:cr-1:u1", "completed-broadcast:cr-1:u2"]));
  });

  it.each(["UNDER_REVIEW", "APPROVED_FOR_IMPLEMENTATION", "FINAL_REVIEW"])("does not broadcast in intermediate state %s", async (status) => {
    tx.changeRequest.findUniqueOrThrow.mockResolvedValue({ ...request, status, finalComment: "Noch nicht abgeschlossen", closedAt: null });
    expect(await queueCompletedRequestBroadcast(tx as never, "cr-1")).toEqual([]);
    expect(tx.user.findMany).not.toHaveBeenCalled();
  });
});
