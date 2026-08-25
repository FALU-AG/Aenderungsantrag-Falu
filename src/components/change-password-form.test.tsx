import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/modules/auth/actions", () => ({ changeOwnPassword: vi.fn() }));
import { ChangePasswordForm } from "./change-password-form";

afterEach(cleanup);
describe("ChangePasswordForm", () => {
  it("fordert Passwort und Bestätigung mit Passwortmanager-Unterstützung an", () => {
    render(<ChangePasswordForm />);
    expect(screen.getByLabelText("Neues Passwort")).toBeRequired();
    expect(screen.getByLabelText("Passwort wiederholen")).toBeRequired();
    expect(screen.getByLabelText("Neues Passwort")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Passwort wiederholen")).toHaveAttribute("autocomplete", "new-password");
  });
});
