import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({
  datasourceUrl: `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}connection_limit=1`,
});
const title = "Playwright Aufgabe Phase 7";

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

test("erstellt, bearbeitet und erledigt eine zugewiesene Aufgabe", async ({
  page,
}) => {
  await page.goto("/change-requests");
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
  await page
    .getByLabel("Beispielbenutzer wechseln")
    .selectOption({ label: "Thomas Technik" });
  await page.waitForTimeout(1_000);
  await page.reload();
  await expect(
    page.locator("header p").filter({ hasText: "Thomas Technik" }),
  ).toBeVisible();
  await page.goto("/meine-aufgaben");
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
