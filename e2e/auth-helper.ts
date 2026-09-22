import { expect, type Page } from "@playwright/test";
import { SAMPLE_USERS } from "../src/modules/auth/sample-users";
import { centralId } from "./harness-identity";

const HARNESS_ORIGIN = process.env.FALU_E2E_ORIGIN ?? `http://127.0.0.1:${process.env.FALU_E2E_PORT ?? 3100}`;

/**
 * There is no login to drive any more: the portal decides who someone is, and the harness
 * signs that decision per request. Setting the identity cookie is the browser-side equivalent
 * of having signed in centrally.
 */
export async function loginAs(page: Page, email = "admin@example.falu.ch") {
  const user = SAMPLE_USERS.find((entry) => entry.email === email);
  if (!user) throw new Error(`Unbekannte Testidentität: ${email}`);
  await page.context().addCookies([{ name: "e2e-identity", value: centralId(user.id), url: HARNESS_ORIGIN }]);
}

/** Uses the real Abmelden link, which points at the portal and clears the identity there. */
export async function logout(page: Page) {
  await page.getByRole("link", { name: "Abmelden" }).first().click();
  await expect(page.getByRole("heading", { name: "Abgemeldet" })).toBeVisible();
}
