import { expect, type Page } from "@playwright/test";
export const DEV_PASSWORD = "Falu-Dev-2026!";
export async function loginAs(page: Page, email = "admin@example.falu.ch", password = DEV_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByRole("textbox", { name: "Passwort", exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
export async function logout(page: Page) { await page.getByRole("button", { name: "Abmelden" }).click(); await expect(page).toHaveURL(/\/login$/); }
