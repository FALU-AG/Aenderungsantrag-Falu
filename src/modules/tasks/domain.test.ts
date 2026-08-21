import { describe, expect, it } from "vitest";
import {
  assignedTaskWhere,
  canCreateAndAssignTasks,
  completionMetadata,
  isTaskOverdue,
  sortTasks,
  taskAccess,
  taskAudit,
  taskSchema,
  taskSummary,
  taskWorkAvailable,
  overdueTaskWhere,
} from "./domain";
const base = {
  title: "Zeichnung aktualisieren",
  description: "",
  responsibleUserId: "u2",
  department: "TECHNICAL",
  dueDate: "",
  priority: "NORMAL",
  status: "OPEN",
  requiredForClosure: true,
};
describe("Aufgaben", () => {
  it("verlangt Titel, Verantwortlichen und Abteilung", () => {
    expect(taskSchema.safeParse(base).success).toBe(true);
    expect(
      taskSchema.safeParse({ ...base, title: "", responsibleUserId: "" })
        .success,
    ).toBe(false);
  });
  it("setzt Berechtigungen für Verantwortliche und Admin", () => {
    const task = {
      createdById: "u1",
      responsibleUserId: "u2",
      status: "OPEN" as const,
    };
    expect(
      taskAccess({ id: "u2", roles: ["EMPLOYEE"] }, task).responsible,
    ).toBe(true);
    expect(
      taskAccess({ id: "u3", roles: ["EMPLOYEE"] }, task).canComplete,
    ).toBe(false);
    expect(taskAccess({ id: "u3", roles: ["ADMINISTRATOR"] }, task).full).toBe(
      true,
    );
  });
  it("beschränkt Erstellen und Zuweisen auf AVOR, Technik und Administration", () => {
    expect(canCreateAndAssignTasks({ roles: ["EMPLOYEE"] })).toBe(false);
    expect(canCreateAndAssignTasks({ roles: ["AVOR"] })).toBe(true);
    expect(canCreateAndAssignTasks({ roles: ["TECHNICAL"] })).toBe(true);
    expect(canCreateAndAssignTasks({ roles: ["ADMINISTRATOR"] })).toBe(true);
  });
  it("lässt zugewiesene Mitarbeiter arbeiten und abschliessen, aber nicht verwalten", () => {
    const access = taskAccess(
      { id: "u2", roles: ["EMPLOYEE"] },
      { createdById: "u1", responsibleUserId: "u2", status: "IN_PROGRESS" },
    );
    expect(access.responsible).toBe(true);
    expect(access.canComplete).toBe(true);
    expect(access.full).toBe(false);
  });
  it("erlaubt technische Aufgaben während offener AVOR-Freigabe und sperrt geschlossene Anträge", () => {
    expect(taskWorkAvailable("UNDER_REVIEW")).toBe(true);
    expect(taskWorkAvailable("CLOSED")).toBe(false);
  });
  it("setzt und leert Abschlussmetadaten", () => {
    expect(completionMetadata("OPEN", "DONE", "u2")).toMatchObject({
      completedById: "u2",
    });
    expect(completionMetadata("DONE", "IN_PROGRESS", "u2")).toEqual({
      completedById: null,
      completedAt: null,
    });
  });
  it("berechnet Überfälligkeit", () => {
    expect(isTaskOverdue(new Date("2020-01-01"), "OPEN")).toBe(true);
    expect(isTaskOverdue(new Date("2020-01-01"), "DONE")).toBe(false);
  });
  it("sortiert aktive Aufgaben vor erledigten", () =>
    expect(
      sortTasks([
        { status: "DONE", dueDate: null },
        { status: "OPEN", dueDate: null },
      ])[0].status,
    ).toBe("OPEN"));
  it("fasst Abschlussrelevanz zusammen", () =>
    expect(
      taskSummary([
        { status: "OPEN", dueDate: null, requiredForClosure: true },
        { status: "DONE", dueDate: null, requiredForClosure: true },
      ]).requiredOpen,
    ).toBe(1));
  it("erstellt deutsche Audits", () =>
    expect(taskAudit("CREATED", "Thomas", "Test").summary).toContain(
      "erstellt",
    ));
  it("beschränkt Meine Aufgaben auf die Zuweisung", () =>
    expect(assignedTaskWhere("u2")).toEqual({ responsibleUserId: "u2" }));
  it("liefert die Dashboard-Abfrage für überfällige Aufgaben", () =>
    expect(overdueTaskWhere(new Date("2026-08-19T12:00:00"))).toMatchObject({
      status: { not: "DONE" },
    }));
});
