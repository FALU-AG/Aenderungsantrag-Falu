import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { RoleSelector } from "./role-selector";

afterEach(cleanup);

describe("RoleSelector", () => {
  it("normalisiert redundante Altdaten in der Benutzeroberfläche", () => {
    render(<RoleSelector defaultRoles={["EMPLOYEE", "AVOR"]} />);
    expect(screen.getByRole("checkbox", { name: "Mitarbeiter" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mitarbeiter" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "AVOR" })).toBeChecked();
  });

  it("entfernt Mitarbeiter bei Auswahl einer erhöhten Rolle und erlaubt AVOR plus Technik", async () => {
    const user = userEvent.setup();
    render(<RoleSelector defaultRoles={["EMPLOYEE"]} />);
    await user.click(screen.getByRole("checkbox", { name: "AVOR" }));
    await user.click(screen.getByRole("checkbox", { name: "Technik" }));
    expect(screen.getByRole("checkbox", { name: "Mitarbeiter" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "AVOR" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Technik" })).toBeChecked();
  });
});
