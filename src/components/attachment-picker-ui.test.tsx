import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttachmentPicker } from "./attachment-picker";

afterEach(cleanup);

describe("AttachmentPicker Datei- und Kameraauswahl", () => {
  it("behält die normale Dateiauswahl mit bestehenden Formaten", () => {
    render(<AttachmentPicker />);
    expect(screen.getByLabelText("Datei auswählen")).toHaveAttribute(
      "accept",
      ".pdf,.png,.jpg,.jpeg,.docx,.xlsx",
    );
    expect(screen.getByRole("button", { name: "Datei auswählen" })).toHaveClass(
      "min-h-11",
      "w-full",
      "sm:w-auto",
    );
  });

  it("bietet eine rückseitige Kamera für unterstützte Bildformate an", () => {
    render(<AttachmentPicker />);
    const camera = screen.getByLabelText("Foto aufnehmen");
    expect(camera).toHaveAttribute("type", "file");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).toHaveAttribute("accept", "image/jpeg,image/png");
    expect(screen.getByRole("button", { name: "Foto aufnehmen" })).toBeInTheDocument();
  });
});
