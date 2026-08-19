import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const url = process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({
  datasourceUrl: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`,
});
const number = "CR-2026-021";
async function switchUser(page: Page, label: string) {
  await page.getByLabel("Beispielbenutzer wechseln").selectOption({ label });
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(
    page.locator("header p").filter({ hasText: label }),
  ).toBeVisible();
}
test.afterEach(async () => {
  const request = await prisma.changeRequest.findUniqueOrThrow({
    where: { number },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.finalApproval.deleteMany({ where: { changeRequestId: request.id } }),
    prisma.auditEvent.deleteMany({
      where: {
        changeRequestId: request.id,
        action: {
          in: [
            "FINAL_REVIEW_APPROVED",
            "FINAL_REVIEW_CLOSED",
            "FINAL_REVIEW_REOPENED",
          ],
        },
      },
    }),
    prisma.task.updateMany({
      where: {
        changeRequestId: request.id,
        title: "Abschlussdokumentation fertigstellen",
      },
      data: { status: "OPEN", completedAt: null, completedById: null },
    }),
    prisma.changeRequest.update({
      where: { id: request.id },
      data: {
        status: "FINAL_REVIEW",
        closedAt: null,
        closedById: null,
        finalReviewCycle: 1,
        finalComment: null,
      },
    }),
  ]);
});
test.afterAll(async () => prisma.$disconnect());
test("blockiert, genehmigt, schliesst und öffnet einen Antrag erneut", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/change-requests");
  await page.getByRole("link", { name: number }).click();
  await page
    .getByRole("link", { name: "Abschlussprüfung", exact: true })
    .click();
  await expect(
    page.getByText("Es sind noch 1 abschlussrelevante Aufgaben offen."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Aufgaben anzeigen" }).click();
  await switchUser(page, "Thomas Technik");
  await page.goto("/meine-aufgaben");
  const task = page.locator("div.rounded-lg").filter({
    has: page.getByRole("heading", {
      name: "Abschlussdokumentation fertigstellen",
    }),
  });
  await task
    .getByRole("button", { name: "In Bearbeitung", exact: true })
    .click();
  const done = task.getByRole("button", { name: "Erledigen", exact: true });
  await expect(done).toBeVisible();
  await done.click();
  await expect(
    task.locator("span").filter({ hasText: /^Erledigt$/ }),
  ).toBeVisible();
  await task.getByRole("link", { name: new RegExp(number) }).click();
  await page
    .getByRole("link", { name: "Abschlussprüfung", exact: true })
    .click();
  await switchUser(page, "Anna AVOR");
  await page.getByRole("button", { name: "Abschluss freigeben" }).click();
  await page
    .getByRole("button", { name: "Abschlussfreigabe bestätigen" })
    .click();
  await expect(
    page.getByText("Abschlussprüfung", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Freigegeben", { exact: true }).first(),
  ).toBeVisible();
  await switchUser(page, "Thomas Technik");
  await page.getByRole("button", { name: "Abschluss freigeben" }).click();
  await page
    .getByRole("button", { name: "Abschlussfreigabe bestätigen" })
    .click();
  await expect(
    page.getByText("Abgeschlossen", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Aufgaben", exact: true }).click();
  await expect(
    page.locator("summary").filter({ hasText: "Aufgabe erstellen" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Abschlussprüfung", exact: true })
    .click();
  await switchUser(page, "Admin Falu");
  await page
    .getByRole("button", { name: "Änderungsantrag erneut öffnen" })
    .click();
  await page
    .getByLabel("Grund für Wiedereröffnung")
    .fill("Nachtrag im Browser-Test");
  await page
    .getByRole("button", { name: "Erneut öffnen", exact: true })
    .click();
  await expect(
    page.getByText("Zur Umsetzung freigegeben", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Historie" }).click();
  await expect(page.getByText(/erneut geöffnet/).first()).toBeVisible();
});
