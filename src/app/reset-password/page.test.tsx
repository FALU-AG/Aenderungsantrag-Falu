import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const usable = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/password-reset", () => ({ isPasswordResetTokenUsable: usable }));
vi.mock("@/components/reset-password-form", () => ({ ResetPasswordForm: ({ token }: { token: string }) => <div data-testid="reset-form">Token: {token}</div> }));
import ResetPasswordPage from "./page";

afterEach(cleanup);
describe("Reset-Passwort-Seite", () => {
  it("reicht einen gültigen Query-Token an das öffentliche Formular weiter", async () => {
    usable.mockResolvedValue(true);
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ token: "valid-token" }) }));
    expect(screen.getByRole("heading", { name: "Neues Passwort setzen" })).toBeInTheDocument();
    expect(screen.getByTestId("reset-form")).toHaveTextContent("valid-token");
  });

  it.each([{ token: undefined }, { token: "invalid-or-expired" }])("zeigt für fehlende oder ungültige Tokens eine öffentliche Fehleransicht", async ({ token }) => {
    usable.mockResolvedValue(false);
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ token }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("ungültig oder abgelaufen");
    expect(screen.getByRole("link", { name: "Neuen Link anfordern" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByTestId("reset-form")).not.toBeInTheDocument();
  });
});
