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

test("erstellt eine Aufgabe und weist sie jemandem zu, der sie in seiner Liste sieht", async ({
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

  // Switching identity must switch what the application shows: the assignee sees the task in
  // their own list, which exercises assignment, the central identity change and the inbox query.
  await logout(page);
  await loginAs(page, "thomas.technik@example.falu.ch");
  await page.goto("meine-aufgaben");
  await expect(page.locator("header p").filter({ hasText: "Thomas Technik" })).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();

  // The status controls that used to live on this page moved when "Meine Aufgaben" became a
  // table. Progressing a task from here is worth covering again against the current design;
  // it is a gap in coverage, not a known defect.
});
