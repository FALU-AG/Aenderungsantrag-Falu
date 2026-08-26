import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestFindMany: vi.fn(), userFindMany: vi.fn(), requestRecipient: vi.fn(), queue: vi.fn(), send: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { changeRequest: { findMany: mocks.requestFindMany }, user: { findMany: mocks.userFindMany } } }));
vi.mock("./recipients", () => ({ requestRecipient: mocks.requestRecipient }));
vi.mock("./repository", () => ({ queueNotification: mocks.queue }));
vi.mock("./service", () => ({ sendNotifications: mocks.send }));

import { runInactivityReminders, runWeeklyTaskDigests } from "./scheduled";

const now = new Date("2026-08-24T06:00:00Z");
const request = (overrides = {}) => ({ id: "cr-1", number: "CR-2026-025", title: "Riemenspanner", status: "UNDER_REVIEW", submittedAt: new Date("2026-08-01T06:00:00Z"), auditEvents: [{ timestamp: new Date("2026-08-17T06:00:00Z") }], ...overrides });
const digestTask = (id: string, dueDate: string | null, status = "OPEN") => ({ id, title: `Aufgabe ${id}`, dueDate: dueDate ? new Date(dueDate) : null, priority: "HIGH", status, changeRequest: { id: `cr-${id}`, number: `CR-2026-${id}`, title: "Antrag" } });

describe("scheduled notification jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestRecipient.mockResolvedValue({ id: "applicant", email: "applicant@falu.ch", name: "Antragsteller" });
    mocks.queue.mockImplementation(async (_db, input) => ({ id: input.idempotencyKey }));
    mocks.send.mockResolvedValue(undefined);
    mocks.requestFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
  });

  it("queues the applicant reminder at seven days with direct link and correct recipient", async () => {
    mocks.requestFindMany.mockResolvedValue([request()]);
    await runInactivityReminders({ now, ignoreSchedule: true });
    expect(mocks.requestRecipient).toHaveBeenCalledWith(expect.anything(), "cr-1");
    expect(mocks.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "REQUEST_INACTIVITY_REMINDER", recipientEmail: "applicant@falu.ch", subject: "Keine Aktivität seit 7 Tagen | CR-2026-025", templateData: expect.objectContaining({ url: "http://localhost:3000/change-requests/cr-1", lastActivity: "17.08.2026" }) }));
  });

  it("does not remind before seven days or for draft/closed requests", async () => {
    mocks.requestFindMany.mockResolvedValue([request({ auditEvents: [{ timestamp: new Date("2026-08-17T06:00:01Z") }] }), request({ id: "draft", status: "DRAFT" }), request({ id: "closed", status: "CLOSED" })]);
    await runInactivityReminders({ now, ignoreSchedule: true });
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("new relevant activity restarts the timer", async () => {
    mocks.requestFindMany.mockResolvedValue([request({ auditEvents: [{ timestamp: new Date("2026-08-22T10:00:00Z") }] })]);
    await runInactivityReminders({ now, ignoreSchedule: true });
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("keeps the same idempotency key in one window and allows the next weekly window", async () => {
    mocks.requestFindMany.mockResolvedValue([request({ auditEvents: [{ timestamp: new Date("2026-08-10T06:00:00Z") }] })]);
    await runInactivityReminders({ now, ignoreSchedule: true });
    await runInactivityReminders({ now: new Date("2026-08-24T12:00:00Z"), ignoreSchedule: true });
    await runInactivityReminders({ now: new Date("2026-08-31T06:00:00Z"), ignoreSchedule: true });
    const keys = mocks.queue.mock.calls.map((call) => call[1].idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("sends one grouped digest for multiple open tasks", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "u1", email: "u1@falu.ch", name: "User 1", assignedTasks: [digestTask("old", "2026-08-23T12:00:00Z"), digestTask("week", "2026-08-28T12:00:00Z"), digestTask("later", "2026-09-01T12:00:00Z")] }]);
    await runWeeklyTaskDigests({ now, ignoreSchedule: true });
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    expect(mocks.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "WEEKLY_TASK_DIGEST", recipientEmail: "u1@falu.ch", templateData: expect.objectContaining({ openCount: 3, overdueCount: 1, dueThisWeekCount: 1, overdue: [expect.objectContaining({ title: "Aufgabe old" })], dueThisWeek: [expect.objectContaining({ title: "Aufgabe week" })], other: [expect.objectContaining({ url: expect.stringContaining("#task-later") })] }) }));
  });

  it("does not send without open tasks and database selection excludes inactive users and DONE tasks", async () => {
    await runWeeklyTaskDigests({ now, ignoreSchedule: true });
    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, assignedTasks: { some: { status: { not: "DONE" } } } }, select: expect.objectContaining({ assignedTasks: expect.objectContaining({ where: { status: { not: "DONE" } } }) }) }));
  });

  it("creates exactly one personal digest for each active user", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "u1", email: "u1@falu.ch", name: "U1", assignedTasks: [digestTask("1", null)] }, { id: "u2", email: "u2@falu.ch", name: "U2", assignedTasks: [digestTask("2", null), digestTask("3", null)] }]);
    await runWeeklyTaskDigests({ now, ignoreSchedule: true });
    expect(mocks.queue).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining("weekly-tasks:u1"), expect.stringContaining("weekly-tasks:u2")]));
  });
});
