import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/change-requests/actions", () => ({ saveChangeRequest: vi.fn(), createMachineType: (code: string) => createMachineTypeMock(code) }));
const createMachineTypeMock = vi.fn();
vi.mock("@/modules/assist/actions", () => ({ formulateText: vi.fn(), transcribeSpeech: vi.fn() }));
import { ChangeRequestForm } from "./change-request-form";

afterEach(cleanup);
const props = { machineTypes: [{ id: "m1", label: "SQB-2AT", active: true }, { id: "m2", label: "CB1", active: true }, { id: "m3", label: "WR-2100 S", active: true }, { id: "m4", label: "WR-600 V", active: true }, { id: "m5", label: "VP-2", active: true }, { id: "m6", label: "PMS", active: true }], reasons: [{ id: "r1", label: "Kundenwunsch" }] };

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
    await user.click(screen.getByRole("button", { name: "WR-2100 S" }));
    await user.click(screen.getByRole("button", { name: "WR-600 V" }));
    await user.click(screen.getByRole("button", { name: "VP-2" }));
    await user.click(screen.getByRole("button", { name: "PMS" }));
    expect(screen.getByRole("button", { name: "SQB-2AT entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CB1 entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WR-2100 S entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WR-600 V entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "VP-2 entfernen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PMS entfernen" })).toBeInTheDocument();
    expect(document.querySelectorAll('input[name="machineTypeIds"]')).toHaveLength(6);
  });
});

describe("Fehlende Maschine nacherfassen", () => {
  const openSelection = async (user: ReturnType<typeof userEvent.setup>, term: string) => {
    await user.click(screen.getByRole("button", { name: /Maschine auswählen/ }));
    await user.type(screen.getByRole("textbox", { name: /Maschinentyp suchen/ }), term);
  };

  it("bietet das Anlegen an, wenn die Maschine wirklich neu ist", async () => {
    const user = userEvent.setup();
    createMachineTypeMock.mockResolvedValue({
      machineType: { id: "neu", label: "WR-3000", active: true },
      notice: `„WR-3000“ wurde angelegt und ausgewählt.`,
    });
    render(<ChangeRequestForm {...props} />);
    await openSelection(user, "wr-3000");

    const create = screen.getByRole("button", { name: /WR-3000. neu anlegen/ });
    await user.click(create);

    expect(createMachineTypeMock).toHaveBeenCalledWith("wr-3000");
    expect(await screen.findByText(/wurde angelegt und ausgewählt/)).toBeInTheDocument();
    // Der neue Typ ist sofort ausgewählt, sonst müsste man ihn nochmals suchen.
    expect(screen.getByRole("button", { name: "WR-3000 entfernen" })).toBeInTheDocument();
  });

  // Genau Linas Beispiel: die Variante ohne V ist eine eigene Maschine, nicht dieselbe.
  it("erkennt WR-600 als neu, obwohl WR-600 V im Katalog steht", async () => {
    const user = userEvent.setup();
    render(<ChangeRequestForm {...props} />);
    await openSelection(user, "WR-600");

    expect(screen.getByRole("button", { name: /WR-600. neu anlegen/ })).toBeInTheDocument();
  });

  it("bietet nichts an, wenn die Maschine nur anders geschrieben wurde", async () => {
    const user = userEvent.setup();
    render(<ChangeRequestForm {...props} />);
    await openSelection(user, "wr600 v");

    expect(screen.queryByRole("button", { name: /neu anlegen/ })).not.toBeInTheDocument();
  });

  it("zeigt die Begründung, wenn der Server ablehnt", async () => {
    const user = userEvent.setup();
    createMachineTypeMock.mockResolvedValue({ error: `„SQB-2A“ steht bereits im Katalog, wurde aber stillgelegt.` });
    render(<ChangeRequestForm {...props} />);
    await openSelection(user, "SQB-2A");
    await user.click(screen.getByRole("button", { name: /neu anlegen/ }));

    expect(await screen.findByText(/stillgelegt/)).toBeInTheDocument();
  });
});
