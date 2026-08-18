import { describe, expect, it } from "vitest";
import { shouldShowCreateRequestCta } from "./create-change-request-cta";

describe("persistente Änderungsantrag-Aktion", () => {
  it("wird auf Haupt- und Detailseiten für berechtigte Benutzer angezeigt", () => {
    expect(shouldShowCreateRequestCta("/", true)).toBe(true);
    expect(shouldShowCreateRequestCta("/change-requests", true)).toBe(true);
    expect(shouldShowCreateRequestCta("/change-requests/cr-1", true)).toBe(
      true,
    );
    expect(shouldShowCreateRequestCta("/administration", true)).toBe(true);
  });

  it("wird ohne Erstellberechtigung nicht angezeigt", () => {
    expect(shouldShowCreateRequestCta("/", false)).toBe(false);
  });

  it("wird auf der Erfassungsseite und Authentifizierungsseiten ausgeblendet", () => {
    expect(shouldShowCreateRequestCta("/change-requests/new", true)).toBe(
      false,
    );
    expect(shouldShowCreateRequestCta("/login", true)).toBe(false);
    expect(shouldShowCreateRequestCta("/auth/callback", true)).toBe(false);
  });
});
