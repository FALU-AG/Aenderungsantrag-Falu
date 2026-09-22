vi.mock("@/modules/auth/directory",()=>({centralUsers:()=>mocks.userFindMany()}));
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userFindMany: vi.fn(), approvalFindMany: vi.fn(), queue: vi.fn(), send: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { user: { findMany: mocks.userFindMany }, approval: { findMany: mocks.approvalFindMany } } }));
vi.mock("./repository", () => ({ queueNotification: mocks.queue }));
vi.mock("./service-core", () => ({ sendNotifications: mocks.send }));

import { runWeeklyDigest } from "./scheduled";

const monday = new Date("2026-08-24T06:00:00Z");
const task = (id = "task-1", status = "OPEN") => ({ id, title: "Zeichnung prüfen", dueDate: new Date("2026-08-23T12:00:00Z"), priority: "HIGH", status, changeRequest: { id: "cr-task", number: "CR-2026-041", title: "Abstreifer" } });
const request = (status = "UNDER_REVIEW") => ({ id: "cr-own", number: "CR-2026-037", title: "Eigener Antrag", status, approvalCycle: 1, approvals: [{ type: "TECHNICAL", status: "PENDING", cycle: 1 }] });
const user = (overrides: Record<string, unknown> = {}) => ({ id: "u1", email: "u1@falu.ch", name: "Anna Beispiel", roles: [{ role: { key: "EMPLOYEE" } }], assignedTasks: [], requests: [], ...overrides });
const pending = (type: "AVOR" | "TECHNICAL", id = "approval-request") => ({ type, cycle: 1, changeRequest: { id, number: "CR-2026-055", title: "Freigabe", approvalCycle: 1 } });

describe("personal weekly digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_BASE_URL = "https://admin.falu.com/aenderungsantrag";
    mocks.userFindMany.mockResolvedValue([]);
    mocks.approvalFindMany.mockResolvedValue([]);
    mocks.queue.mockImplementation(async (_db, input) => ({ id: input.idempotencyKey }));
    mocks.send.mockResolvedValue(undefined);
  });

  it("combines tasks, own requests, and explicit AVOR/Technical responsibilities into one notification", async () => {
    mocks.userFindMany.mockResolvedValue([user({ roles: [{ role: { key: "AVOR" } }, { role: { key: "TECHNICAL" } }], assignedTasks: [task()], requests: [request()] })]);
    mocks.approvalFindMany.mockResolvedValue([pending("AVOR"), pending("TECHNICAL")]);
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    expect(mocks.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idempotencyKey: "weekly-digest:u1:2026-W35", templateData: expect.objectContaining({ overdue: [expect.objectContaining({ title: "Zeichnung prüfen" })], ownRequests: [expect.objectContaining({ status: "Wartet auf technische Freigabe" })], approvals: [expect.objectContaining({ responsibility: "AVOR + Technik-Freigabe erforderlich" })] }) }));
  });

  it.each([
    ["only tasks", user({ assignedTasks: [task()] }), []],
    ["only own requests", user({ requests: [request("DRAFT")] }), []],
    ["only approvals", user({ roles: [{ role: { key: "AVOR" } }] }), [pending("AVOR")]],
  ])("queues one digest for %s", async (_label, digestUser, approvals) => {
    mocks.userFindMany.mockResolvedValue([digestUser]);
    mocks.approvalFindMany.mockResolvedValue(approvals);
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    expect(mocks.queue).toHaveBeenCalledOnce();
  });

  it("queues nothing for a user without open items", async () => {
    mocks.userFindMany.mockResolvedValue([user()]);
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith([]);
  });

  it("selects only active users, non-closed requests, and non-completed tasks", async () => {
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [] } }, select: expect.objectContaining({ requests: expect.objectContaining({ where: { status: { not: "CLOSED" } } }), assignedTasks: expect.objectContaining({ where: { status: { not: "DONE" } } }) }) }));
  });

  it("does not give an admin-only user approval responsibility", async () => {
    mocks.userFindMany.mockResolvedValue([user({ roles: [{ role: { key: "ADMINISTRATOR" } }] })]);
    mocks.approvalFindMany.mockResolvedValue([pending("AVOR")]);
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("keeps the same per-user ISO-week idempotency key on repeated runs", async () => {
    mocks.userFindMany.mockResolvedValue([user({ assignedTasks: [task()] })]);
    await runWeeklyDigest({ now: monday, ignoreSchedule: true });
    await runWeeklyDigest({ now: new Date("2026-08-24T06:30:00Z"), ignoreSchedule: true });
    expect(mocks.queue.mock.calls[0][1].idempotencyKey).toBe(mocks.queue.mock.calls[1][1].idempotencyKey);
  });

  it("honors Monday 08:00 Europe/Zurich gating without database or Slack work", async () => {
    expect(await runWeeklyDigest({ now: new Date("2026-08-25T06:00:00Z") })).toEqual({ queued: 0, skippedSchedule: true });
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
