import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/modules/change-requests/actions", () => ({ deleteChangeRequest: vi.fn() }));
import { DeleteChangeRequestAction } from "./delete-change-request-action";

afterEach(cleanup);
describe("DeleteChangeRequestAction", () => {
  it("verlangt eine explizite destruktive Bestätigung mit Antragsnummer", async () => {
    const user = userEvent.setup(); render(<DeleteChangeRequestAction requestId="cr-1" requestNumber="CR-2026-030" />);
    await user.click(screen.getByRole("button", { name: "Änderungsantrag löschen" }));
    expect(screen.getByRole("dialog", { name: "Änderungsantrag wirklich löschen?" })).toBeInTheDocument();
    expect(screen.getByText(/CR-2026-030.*dauerhaft gelöscht/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Endgültig löschen" })).toBeInTheDocument();
  });
});
