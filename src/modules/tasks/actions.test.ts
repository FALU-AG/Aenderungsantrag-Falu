import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/modules/authorization/permissions";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requestFind: vi.fn(),
  transaction: vi.fn(),
  taskFind: vi.fn(),
  taskUpdate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth", () => ({
  getCurrentUser: mocks.currentUser,
}));
vi.mock("@/server/db/client", () => ({
  db: {
    changeRequest: { findUniqueOrThrow: mocks.requestFind },
    task: { findUniqueOrThrow: mocks.taskFind },
    $transaction: mocks.transaction,
  },
}));

import { createTask, updateTask } from "./actions";

describe("createTask", () => {
  it("weist direkte Erstellversuche von Mitarbeitern serverseitig ab", async () => {
    mocks.currentUser.mockResolvedValue({
      id: "employee-1",
      name: "Erika Mitarbeiterin",
      email: "employee@falu.test",
      roles: ["EMPLOYEE"],
    });
    await expect(createTask("cr-1", {}, new FormData())).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(mocks.requestFind).not.toHaveBeenCalled();
  });

  it("verhindert direkte Neuzuweisung durch zugewiesene Mitarbeiter und ändert die Aufgabe nicht", async () => {
    mocks.currentUser.mockResolvedValue({
      id: "employee-1",
      name: "Erika Mitarbeiterin",
      email: "employee@falu.test",
      roles: ["EMPLOYEE"],
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        task: {
          findUniqueOrThrow: vi.fn(async () => ({
            id: "task-1",
            title: "Bestehende Aufgabe",
            description: null,
            responsibleUserId: "employee-1",
            createdById: "technical-1",
            department: "TECHNICAL",
            dueDate: null,
            priority: "NORMAL",
            status: "OPEN",
            requiredForClosure: true,
            changeRequestId: "cr-1",
            responsibleUser: { name: "Erika Mitarbeiterin" },
            changeRequest: { status: "UNDER_REVIEW" },
          })),
          update: mocks.taskUpdate,
        },
      }),
    );
    const form = new FormData();
    form.set("title", "Bestehende Aufgabe");
    form.set("description", "");
    form.set("responsibleUserId", "other-user");
    form.set("department", "TECHNICAL");
    form.set("dueDate", "");
    form.set("priority", "NORMAL");
    form.set("status", "OPEN");
    form.set("requiredForClosure", "on");

    await expect(updateTask("task-1", {}, form)).rejects.toThrow(
      "Sie dürfen Aufgaben nicht anderen Personen zuweisen.",
    );
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });
});
