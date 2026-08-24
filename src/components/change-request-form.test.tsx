import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/change-requests/actions", () => ({ saveChangeRequest: vi.fn() }));
vi.mock("@/modules/assist/actions", () => ({ formulateText: vi.fn(), transcribeSpeech: vi.fn() }));
import { ChangeRequestForm } from "./change-request-form";

afterEach(cleanup);
const props = { machineTypes: [{ id: "m1", label: "SQB-2AT", active: true }, { id: "m2", label: "CB1", active: true }], reasons: [{ id: "r1", label: "Kundenwunsch" }] };

describe("ChangeRequestForm UX", () => {
  it("befüllt den Antragsteller mit dem angemeldeten Benutzer und lässt ihn änderbar", async () => {
    const user = userEvent.setup();
    render(<ChangeRequestForm {...props} defaultApplicantName="Florian Kaufmann" />);
    const applicant = screen.getByRole("textbox", { name: /Antragsteller/ });
    expect(applicant).toHaveValue("Florian Kaufmann");
    await user.clear(applicant);
    await user.type(applicant, "Marc Wyss");
    expect(applicant).toHaveValue("Marc Wyss");
  });

  it("zeigt hilfreiche Platzhalter ohne sie als Werte zu verwenden", () => {
    render(<ChangeRequestForm {...props} />);
    const title = screen.getByPlaceholderText("z. B. Riemenspanner hält Spannung nicht");
    expect(title).toHaveValue("");
    expect(screen.getByPlaceholderText("z. B. CBX.220.259-C")).toHaveValue("");
    expect(screen.getByPlaceholderText("z. B. Halteplatte Riemenspanner")).toHaveValue("");
    expect(screen.getByPlaceholderText("z. B. Der Riemen verliert nach kurzer Laufzeit die erforderliche Spannung.")).toHaveValue("");
  });

  it("rendert die Baugruppenbezeichnung als normales Textfeld ohne AI oder Spracheingabe", () => {
    render(<ChangeRequestForm {...props} />);
    const field = screen.getByRole("textbox", { name: /Artikel-\/Baugruppenbezeichnung/ });
    const label = field.closest("label");
    expect(label).not.toBeNull();
    expect(within(label!).queryByRole("button")).not.toBeInTheDocument();
  });

  it("überschreibt den Antragsteller eines bestehenden Antrags nicht", () => {
    render(<ChangeRequestForm {...props} defaultApplicantName="Florian Kaufmann" initial={{ id: "cr1", version: 1, number: "CR-2026-001", createdAt: "20.08.2026", applicantName: "Marc Wyss", title: "", machineTypeIds: [], articleNumber: "", articleDescription: "", reasonIds: [], otherReasonText: "", description: "" }} />);
    expect(screen.getByRole("textbox", { name: /Antragsteller/ })).toHaveValue("Marc Wyss");
  });
  it("wählt mehrere Maschinentypen touch-freundlich aus und zeigt sie als Chips", async () => {
    const user = userEvent.setup();
    render(<ChangeRequestForm {...props} />);
    await user.click(screen.getByRole("button", { name: /Maschine auswählen/ }));
    await user.click(screen.getByRole("button", { name: "SQB-2AT" }));
    await user.click(screen.getByRole("button", { name: "CB1" }));
    expect(screen.getByRole("button", { name: "SQB-2AT entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CB1 entfernen" })).toBeInTheDocument();
    expect(document.querySelectorAll('input[name="machineTypeIds"]')).toHaveLength(2);
  });
});
