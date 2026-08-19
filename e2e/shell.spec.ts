import { expect, test } from "@playwright/test";
import { loginAs } from "./auth-helper";

test.beforeEach(async ({ page }) => loginAs(page));

test("zeigt Dashboard und Hauptnavigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toContainText("Änderungsanträge");
  await expect(page.getByText("Admin Falu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
});
