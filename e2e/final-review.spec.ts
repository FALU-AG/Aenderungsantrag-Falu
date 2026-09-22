import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loginAs } from "./auth-helper";
import { e2eDatabaseUrl } from "./database";
const url = e2eDatabaseUrl();
const prisma = new PrismaClient({
  datasourceUrl: `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`,
});
const number = "CR-2026-021";
test.beforeEach(async ({page})=>loginAs(page));
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
// OFFEN: Server-Aktionen liefern hinter der Testumgebung keine Antwort. Die Aktion selbst
// laeuft vollstaendig durch - die Aufgabe wird angelegt, Benachrichtigungen werden erzeugt -
// aber Next sendet danach keine Antwort, und der Browser wartet unbegrenzt. Eingegrenzt bis:
// Proxy fertig, Aktion fertig, danach nichts. Ungeklaert, ob das nur am HTTP-Weiterleiten der
// Testumgebung im Entwicklungsmodus liegt oder auch in Produktion hinter Cloudflare auftritt.
// Siehe docs/PHASE_B_REVIEW.md, Befund H3. Muss vor dem Stichtag geklaert sein.
test.fixme("blockiert, genehmigt, schliesst und öffnet einen Antrag erneut", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("change-requests");
  await page.getByRole("link", { name: number }).click();
  await page
    .getByRole("navigation", { name: "Workflow des Änderungsantrags" })
    .getByRole("link", { name: "Abschlussprüfung" })
    .click();
  await expect(
    page.getByText("Es sind noch 1 abschlussrelevante Aufgaben offen."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Aufgaben anzeigen" }).click();
  await prisma.task.updateMany({ where: { changeRequest: { number }, requiredForClosure: true }, data: { status: "DONE", completedAt: new Date() } });
  await page
    .getByRole("navigation", { name: "Workflow des Änderungsantrags" })
    .getByRole("link", { name: "Abschlussprüfung" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Abschluss freigeben" }).first().click();
  await page
    .getByRole("button", { name: "Abschlussfreigabe bestätigen" })
    .click();
  await expect(
    page.getByText("Abschlussprüfung", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Freigegeben", { exact: true }).first(),
  ).toBeVisible();
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
    .getByRole("navigation", { name: "Workflow des Änderungsantrags" })
    .getByRole("link", { name: "Abschlussprüfung" })
    .click();
  await page
    .getByRole("button", { name: "Änderungsantrag erneut öffnen" })
    .click();
  await page
    .getByLabel("Grund für Wiedereröffnung")
    .fill("Nachtrag im Browser-Test");
  await page
    .getByRole("button", { name: "Erneut öffnen", exact: true })
    .click();
  await page.reload();
  await page.getByRole("link", { name: "Historie" }).click();
  await expect(page.getByText(/erneut geöffnet/).first()).toBeVisible();
});
