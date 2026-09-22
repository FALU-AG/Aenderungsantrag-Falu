import { expect, test } from "@playwright/test";
import { loginAs, logout } from "./auth-helper";

/**
 * The application has no login and no user administration of its own any more. What is worth
 * proving in a real browser is the boundary: no identity means no access, the displayed
 * identity is the central one, roles decide what the navigation offers, and signing out
 * centrally ends access here too.
 */

test("verweist ohne zentrale Identität auf die Anmeldung im Portal", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
});

test("zeigt den zentral geprüften Namen und die Administrationsnavigation", async ({ page }) => {
  await loginAs(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator("header p").filter({ hasText: "Admin Falu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stellvertretungen verwalten" })).toBeVisible();
});

test("bietet einer Person ohne Fachrolle weder Stellvertretung noch Administration", async ({ page }) => {
  await loginAs(page, "max.muster@example.falu.ch");
  await page.goto("./");
  await expect(page.locator("header p").filter({ hasText: "Max Muster" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stellvertretungen verwalten" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Stellvertretung", exact: true })).toHaveCount(0);
});

test("weist den Administrationsbereich serverseitig ab, nicht nur in der Navigation", async ({ page }) => {
  await loginAs(page, "max.muster@example.falu.ch");
  await page.goto("admin/delegations");
  await expect(page).not.toHaveURL(/admin\/delegations/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("beendet mit dem Abmelden auch den Zugriff auf die Anwendung", async ({ page }) => {
  await loginAs(page);
  await page.goto("./");
  await logout(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});
