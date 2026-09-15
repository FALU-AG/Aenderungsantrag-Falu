import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ activeRoleRecipients: vi.fn(), requestRecipient: vi.fn(), queue: vi.fn() }));
vi.mock("./recipients", () => ({ activeRoleRecipients: mocks.activeRoleRecipients, requestRecipient: mocks.requestRecipient }));
vi.mock("./repository", () => ({ queueNotification: mocks.queue }));
import { queueApprovalCycleNotifications, queueRequestNotification, queueTaskAssignmentNotification } from "./workflow";

const request = { id: "cr-1", number: "CR-2026-001", title: "Riemenspanner", status: "UNDER_REVIEW", applicantName: "Anna Antrag", approvalCycle: 1, finalReviewCycle: 1, machineTypes: [{ machineType: { code: "M1" } }] };
const tx = {
  changeRequest: { findUniqueOrThrow: vi.fn().mockResolvedValue(request) },
  task: { findUniqueOrThrow: vi.fn() },
};

describe("workflow notification orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "https://admin.falu.com/aenderungsantrag";
    mocks.queue.mockImplementation(async (_tx, input) => ({ id: input.idempotencyKey }));
    mocks.activeRoleRecipients.mockImplementation(async (_tx, role) => role === "AVOR" ? [{ id: "avor", email: "avor@falu.ch", name: "Anna AVOR" }] : [{ id: "tech", email: "tech@falu.ch", name: "Theo Technik" }]);
    mocks.requestRecipient.mockResolvedValue({ id: "applicant", email: "applicant@falu.ch", name: "Anna Antrag" });
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
});
