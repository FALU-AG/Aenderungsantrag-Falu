import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./password";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(), userUpdate: vi.fn(), transaction: vi.fn(),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", name: "Test", email: "test@falu.ch", roles: ["EMPLOYEE"] })),
  createSession: vi.fn(), invalidateCurrentSession: vi.fn(), invalidateUserSessions: vi.fn(), redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("@/server/db/client", () => ({ db: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate }, session: { deleteMany: vi.fn() }, $transaction: mocks.transaction } }));
vi.mock(".", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("./session", () => ({ createSession: mocks.createSession, invalidateCurrentSession: mocks.invalidateCurrentSession, invalidateUserSessions: mocks.invalidateUserSessions }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { changeOwnPassword, login } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("Passwortaktionen", () => {
  it("aktualisiert bei abweichender Bestätigung weder Hash noch Sitzungen", async () => {
    const form = new FormData(); form.set("password", "SicheresPasswort1!"); form.set("passwordConfirmation", "AnderesPasswort1!");
    const result = await changeOwnPassword({}, form);
    expect(result.errors?.passwordConfirmation).toBe("Die Passwörter stimmen nicht überein.");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.invalidateUserSessions).not.toHaveBeenCalled();
  });

  it("speichert passende Passwörter gehasht und erneuert die Sitzung", async () => {
    mocks.userUpdate.mockResolvedValue({});
    const form = new FormData(); form.set("password", "SicheresPasswort1!"); form.set("passwordConfirmation", "SicheresPasswort1!");
    await expect(changeOwnPassword({}, form)).rejects.toThrow("NEXT_REDIRECT");
    const passwordHash = mocks.userUpdate.mock.calls[0][0].data.passwordHash;
    expect(await verifyPassword("SicheresPasswort1!", passwordHash)).toBe(true);
    expect(mocks.invalidateUserSessions).toHaveBeenCalledWith("user-1");
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });

  it("behält den bestehenden Login-Ablauf bei", async () => {
    const password = "SicheresPasswort1!";
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", active: true, mustChangePassword: false, passwordHash: await hashPassword(password) });
    mocks.transaction.mockResolvedValue([]);
    const form = new FormData(); form.set("email", "TEST@FALU.CH"); form.set("password", password);
    await expect(login({}, form)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.userFindUnique).toHaveBeenCalledWith({ where: { email: "test@falu.ch" } });
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });
});
