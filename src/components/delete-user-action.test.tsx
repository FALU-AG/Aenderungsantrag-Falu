import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/users/actions", () => ({ deleteUser: vi.fn() }));
import { DeleteUserAction } from "./delete-user-action";

afterEach(cleanup);

describe("DeleteUserAction", () => {
  it("zeigt vor der endgültigen Löschung einen destruktiven Bestätigungsdialog", async () => {
    const user = userEvent.setup();
    render(<DeleteUserAction userId="target" userName="Test User" />);
    await user.click(screen.getByRole("button", { name: "Benutzer löschen" }));
    expect(screen.getByRole("dialog", { name: "Benutzer endgültig löschen?" })).toBeInTheDocument();
    expect(screen.getByText("Dieser Benutzer wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Endgültig löschen" })).toBeInTheDocument();
  });
});
