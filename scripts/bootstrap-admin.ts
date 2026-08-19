import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim();
  if (!email || !firstName || !lastName || password.length < 10) throw new Error("Bootstrap-Variablen fehlen oder das Passwort ist kürzer als 10 Zeichen.");
  const existingAdmin = await db.user.findFirst({ where: { active: true, roles: { some: { role: { key: "ADMINISTRATOR" } } } } });
  if (existingAdmin) { console.log("Ein aktiver Administrator ist bereits vorhanden; Zugangsdaten wurden nicht verändert."); return; }
  const role = await db.role.upsert({ where: { key: "ADMINISTRATOR" }, update: { name: "Administrator" }, create: { key: "ADMINISTRATOR", name: "Administrator" } });
  const existing = await db.user.findUnique({ where: { email } });
  const user = existing
    ? await db.user.update({ where: { id: existing.id }, data: { active: true, passwordHash: await hash(password, 12), firstName, lastName, name: `${firstName} ${lastName}` } })
    : await db.user.create({ data: { email, firstName, lastName, name: `${firstName} ${lastName}`, active: true, passwordHash: await hash(password, 12) } });
  await db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  await db.auditEvent.create({ data: { userId: user.id, action: "ADMINISTRATOR_BOOTSTRAPPED", entityType: "User", entityId: user.id, summary: `${user.name} wurde als erster Administrator eingerichtet.` } });
  console.log("Administrator wurde eingerichtet.");
}
main().finally(() => db.$disconnect());
