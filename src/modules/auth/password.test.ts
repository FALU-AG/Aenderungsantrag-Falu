import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./password";
describe("Passwortsicherheit", () => {
  it("verlangt mindestens zehn Zeichen", () => { expect(validatePassword("Kurz123!" )).toBe(false); expect(validatePassword("LangGenug1!" )).toBe(true); });
  it("speichert und prüft nur einen Hash", async () => { const password = "SicheresPasswort1!"; const hashed = await hashPassword(password); expect(hashed).not.toContain(password); expect(await verifyPassword(password, hashed)).toBe(true); expect(await verifyPassword("FalschPasswort1!", hashed)).toBe(false); });
});
