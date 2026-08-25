import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("ist standardmässig verborgen und wechselt zugänglich zwischen sichtbar und verborgen", () => {
    render(<PasswordInput label="Passwort" name="password" />);
    const input = screen.getByLabelText("Passwort");
    expect(input).toHaveAttribute("type", "password");
    const show = screen.getByRole("button", { name: "Passwort anzeigen" });
    expect(show).toHaveClass("min-h-11", "min-w-11");
    fireEvent.click(show);
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Passwort ausblenden" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("löst beim Umschalten kein Formular-Submit aus", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><PasswordInput label="Passwort" name="password" /></form>);
    fireEvent.click(screen.getByRole("button", { name: "Passwort anzeigen" }));
    expect(submit).not.toHaveBeenCalled();
  });
});
