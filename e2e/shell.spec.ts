import { expect, test } from "@playwright/test";

test("zeigt Dashboard und Hauptnavigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toContainText("Änderungsanträge");
  await expect(page.getByLabel("Beispielbenutzer wechseln")).toBeVisible();
});
