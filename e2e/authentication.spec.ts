import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { DEV_PASSWORD, loginAs, logout } from "./auth-helper";
const db = new PrismaClient({ datasourceUrl: `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes("?")?"&":"?"}connection_limit=1` });
const email = "phase9.e2e@example.falu.ch";
test.afterEach(async()=>{const user=await db.user.findUnique({where:{email}});if(user){await db.session.deleteMany({where:{userId:user.id}});await db.auditEvent.deleteMany({where:{entityType:"User",entityId:user.id}});await db.userRole.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}});}});
test.afterAll(async()=>db.$disconnect());
test("Anmeldung, Benutzerverwaltung, Zugriff und AVOR-Einkauf",async({page})=>{
  await page.goto("/"); await expect(page).toHaveURL(/\/login$/);
  await loginAs(page); await page.goto("/admin/users"); await expect(page.getByRole("heading",{name:"Benutzerverwaltung"})).toBeVisible();
  await page.locator("summary").filter({hasText:"Benutzer erstellen"}).click();
  await page.getByPlaceholder("Vorname").fill("Phase"); await page.getByPlaceholder("Nachname").fill("Neun"); await page.getByPlaceholder("E-Mail").fill(email); await page.getByLabel("Initiales Passwort").fill(DEV_PASSWORD); await page.getByLabel("Passwort wiederholen").fill(DEV_PASSWORD); await page.getByRole("button",{name:"Benutzer erstellen"}).click();
  await expect(page.getByText(email)).toBeVisible(); await logout(page); await loginAs(page,email); await expect(page.getByRole("heading",{name:"Dashboard"})).toBeVisible();
  await page.goto("/admin/users"); await expect(page).toHaveURL("/"); await logout(page);
  await loginAs(page,"anna.avor@example.falu.ch"); await page.goto("/change-requests?q=CR-2026-008"); await page.getByRole("link",{name:"CR-2026-008"}).click(); await page.getByRole("link",{name:"Einkauf",exact:true}).click(); await expect(page.getByRole("heading",{name:"Einkauf / Beschaffung"})).toBeVisible(); await expect(page.getByRole("button",{name:/Speichern|Einkaufsprüfung/}).first()).toBeEnabled(); await logout(page);
});
