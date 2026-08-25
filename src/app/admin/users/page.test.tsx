import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { counts } = vi.hoisted(() => ({ counts: { requests: 1, approvals: 0, finalApprovals: 0, technicalReviews: 0, avorReviews: 0, purchasingReviews: 0, placedPurchaseOrders: 0, assignedTasks: 0, createdTasks: 0, completedTasks: 0, attachments: 0, comments: 0, auditEvents: 0, closedRequests: 0 } }));
vi.mock("@/modules/auth", () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: "admin", name: "Admin", roles: ["ADMINISTRATOR"] }) }));
vi.mock("@/modules/users/actions", () => ({ createUser: vi.fn(), updateUser: vi.fn(), resetPassword: vi.fn(), deleteUser: vi.fn() }));
vi.mock("@/server/db/client", () => ({ db: { user: {
  findMany: vi.fn().mockResolvedValue([{ id: "user-1", name: "Anna AVOR", firstName: "Anna", lastName: "AVOR", email: "anna@falu.ch", active: true, lastLoginAt: new Date("2026-08-20T08:23:00Z"), roles: [{ role: { key: "EMPLOYEE" } }, { role: { key: "AVOR" } }], _count: counts }]),
  count: vi.fn().mockResolvedValue(1),
} } }));
import UsersPage from "./page";

afterEach(cleanup);
describe("Benutzerverwaltung", () => {
  it("rendert eine kompakte Liste mit eingeklappten Bearbeitungsaktionen und normalisierten Rollen", async () => {
    render(await UsersPage());
    expect(screen.getByRole("table", { name: "Benutzer" })).toBeInTheDocument();
    const row = screen.getByText("Anna AVOR").closest('[role="row"]');
    expect(row).not.toBeNull();
    const badges = [...row!.querySelectorAll("span.rounded-full")].map((item) => item.textContent);
    expect(badges).toContain("AVOR");
    expect(badges).not.toContain("Mitarbeiter");
    const edit = screen.getByText("Bearbeiten").closest("details");
    expect(edit).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Änderungen speichern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Benutzer kann nicht gelöscht werden" })).toBeDisabled();
    expect(screen.getByText("Dieser Benutzer kann nicht gelöscht werden, da geschäftliche Aktivitäten mit ihm verknüpft sind.")).toBeInTheDocument();
    expect(screen.getByText("Erstellte Änderungsanträge: 1")).toBeInTheDocument();
    expect(screen.getByText("20.08.2026, 10:23")).toBeInTheDocument();
  });
});
