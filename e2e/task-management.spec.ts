import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs, logout } from "./auth-helper";

import { e2eDatabaseUrl } from "./database";
const databaseUrl = e2eDatabaseUrl();
const prisma = new PrismaClient({
  datasourceUrl: `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}connection_limit=1`,
});
const title = "Playwright Aufgabe Phase 7";
test.beforeEach(async ({page})=>loginAs(page));

test.afterEach(async () => {
  const tasks = await prisma.task.findMany({
    where: { title },
    select: { id: true },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      entityType: "Task",
      entityId: { in: tasks.map((task) => task.id) },
    },
  });
  await prisma.task.deleteMany({ where: { title } });
});

test.afterAll(async () => prisma.$disconnect());

// OFFEN: Server-Aktionen liefern hinter der Testumgebung keine Antwort. Die Aktion selbst
// laeuft vollstaendig durch - die Aufgabe wird angelegt, Benachrichtigungen werden erzeugt -
// aber Next sendet danach keine Antwort, und der Browser wartet unbegrenzt. Eingegrenzt bis:
// Proxy fertig, Aktion fertig, danach nichts. Ungeklaert, ob das nur am HTTP-Weiterleiten der
// Testumgebung im Entwicklungsmodus liegt oder auch in Produktion hinter Cloudflare auftritt.
// Siehe docs/PHASE_B_REVIEW.md, Befund H3. Muss vor dem Stichtag geklaert sein.
test.fixme("erstellt, bearbeitet und erledigt eine zugewiesene Aufgabe", async ({
  page,
}) => {
  await page.goto("change-requests?q=CR-2026-004");
  await page.getByRole("link", { name: "CR-2026-004" }).click();
  await page.getByRole("link", { name: "Aufgaben", exact: true }).click();
  await expect(page).toHaveURL(/tab=Aufgaben/);
  await page.reload();
  await page
    .locator("summary")
    .filter({ hasText: "Aufgabe erstellen" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Neue Aufgabe" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: /Titel/ }).fill(title);
  await page
    .getByLabel("Verantwortlich")
    .first()
    .selectOption({ label: "Thomas Technik" });
  await page
    .getByRole("button", { name: "Aufgabe erstellen", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
  await logout(page);
  await loginAs(page, "thomas.technik@example.falu.ch");
  await page.goto("meine-aufgaben");
  await expect(
    page.locator("header p").filter({ hasText: "Thomas Technik" }),
  ).toBeVisible();
  await page.goto("meine-aufgaben");
  const card = page
    .locator("div.rounded-lg")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await card
    .getByRole("button", { name: "In Bearbeitung", exact: true })
    .click();
  const completeButton = card.getByRole("button", {
    name: "Erledigen",
    exact: true,
  });
  await expect(completeButton).toBeVisible();
  await completeButton.click();
  await expect(
    card.locator("span").filter({ hasText: /^Erledigt$/ }),
  ).toBeVisible();
  await card.getByRole("link", { name: /CR-2026-004/ }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
