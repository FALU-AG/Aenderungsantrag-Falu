import { describe, expect, it } from "vitest";
import { assertAdministratorRemains, normalizeEmail, normalizeRoles, roleSummary, selectableRoles } from "./domain";
describe("Benutzerverwaltung", () => {
  it("normalisiert E-Mail-Adressen",()=>expect(normalizeEmail(" Admin@FALU.CH ")).toBe("admin@falu.ch"));
  it("bietet exakt vier Rollen ohne Einkauf an",()=>expect(selectableRoles).toEqual(["EMPLOYEE","AVOR","TECHNICAL","ADMINISTRATOR"]));
  it("schützt den letzten aktiven Administrator",()=>expect(()=>assertAdministratorRemains(1,true,true)).toThrow("Es muss mindestens ein aktiver Administrator vorhanden sein."));
  it("erlaubt die Änderung bei einem weiteren Administrator",()=>expect(()=>assertAdministratorRemains(2,true,true)).not.toThrow());
  it("entfernt die redundante Mitarbeiterrolle beim Speichern", () => {
    expect(normalizeRoles(["EMPLOYEE", "AVOR"])).toEqual(["AVOR"]);
    expect(normalizeRoles(["EMPLOYEE", "TECHNICAL"])).toEqual(["TECHNICAL"]);
    expect(normalizeRoles(["EMPLOYEE", "AVOR", "TECHNICAL"])).toEqual(["AVOR", "TECHNICAL"]);
    expect(normalizeRoles(["EMPLOYEE", "ADMINISTRATOR"])).toEqual(["ADMINISTRATOR"]);
  });
  it("zeigt nur normalisierte, aussagekräftige Rollen an", () => {
    expect(roleSummary(["EMPLOYEE", "AVOR"])).toBe("AVOR");
    expect(roleSummary(["AVOR", "TECHNICAL"])).toBe("AVOR, Technik");
  });
});
