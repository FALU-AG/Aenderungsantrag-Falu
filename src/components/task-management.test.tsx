import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskManagement } from "./task-management";

vi.mock("@/modules/tasks/actions", () => ({
  createTask: vi.fn(),
  deleteOpenTask: vi.fn(),
  quickTaskStatus: vi.fn(),
  updateTask: vi.fn(),
}));

const task = {
  id: "task-1",
  title: "Zeichnung prüfen",
  description: "Prüfung durchführen",
  responsibleUserId: "employee-1",
  responsibleUser: { name: "Erika Mitarbeiterin" },
  department: "TECHNICAL" as const,
  dueDate: null,
  priority: "NORMAL" as const,
  status: "IN_PROGRESS" as const,
  requiredForClosure: true,
  createdById: "technical-1",
  overdue: false,
};

describe("TaskManagement", () => {
  afterEach(cleanup);

  it("zeigt Mitarbeitern Aufgaben, aber keine Erstellung oder Zuweisungssteuerung", () => {
    render(
      <TaskManagement
        requestId="cr-1"
        tasks={[task]}
        users={[{ id: "employee-1", name: "Erika Mitarbeiterin" }]}
        currentUserId="employee-1"
        isAdmin={false}
        canCreateAndAssign={false}
      />,
    );
    expect(screen.queryByText("Aufgabe erstellen")).not.toBeInTheDocument();
    expect(screen.getByText("Zeichnung prüfen")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Verantwortlich" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Beschreibung")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Speichern" })).toBeEnabled();
  });

  it("zeigt AVOR, Technik und Administration die Aufgabenerstellung", () => {
    render(
      <TaskManagement
        requestId="cr-1"
        tasks={[]}
        users={[]}
        currentUserId="technical-1"
        isAdmin={false}
        canCreateAndAssign
      />,
    );
    expect(screen.getAllByText("Aufgabe erstellen").length).toBeGreaterThan(0);
  });
});
