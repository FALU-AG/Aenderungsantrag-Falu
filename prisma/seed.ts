import { PrismaClient } from "@prisma/client";
import { SAMPLE_USERS } from "../src/modules/auth/sample-users";
import { CHANGE_REASONS, MACHINE_TYPES } from "../src/modules/reference-data";

const prisma = new PrismaClient();

async function main() {
  const roleKeys = ["EMPLOYEE", "AVOR", "TECHNICAL", "PURCHASING", "ADMINISTRATOR"] as const;

  for (const key of roleKeys) {
    await prisma.role.upsert({
      where: { key },
      update: { name: key === "EMPLOYEE" ? "Mitarbeitende" : key === "TECHNICAL" ? "Technik" : key === "PURCHASING" ? "Einkauf" : key === "ADMINISTRATOR" ? "Administration" : "AVOR" },
      create: { key, name: key === "EMPLOYEE" ? "Mitarbeitende" : key === "TECHNICAL" ? "Technik" : key === "PURCHASING" ? "Einkauf" : key === "ADMINISTRATOR" ? "Administration" : "AVOR" },
    });
  }

  const roles = await prisma.role.findMany();
  const roleByKey = new Map(roles.map((role) => [role.key, role.id]));

  for (const sample of SAMPLE_USERS) {
    await prisma.user.upsert({
      where: { email: sample.email },
      update: { name: sample.name, active: true, roles: { deleteMany: {}, create: sample.roles.map((role) => ({ roleId: roleByKey.get(role)! })) } },
      create: { id: sample.id, name: sample.name, email: sample.email, active: true, roles: { create: sample.roles.map((role) => ({ roleId: roleByKey.get(role)! })) } },
    });
  }

  for (const machine of MACHINE_TYPES) {
    await prisma.machineType.upsert({ where: { code: machine.code }, update: machine, create: machine });
  }

  for (const reason of CHANGE_REASONS) {
    await prisma.changeReason.upsert({ where: { key: reason.key }, update: reason, create: reason });
  }

  await prisma.appSetting.upsert({ where: { key: "defaultCurrency" }, update: { value: "CHF" }, create: { key: "defaultCurrency", value: "CHF", description: "Standardwährung" } });
  await prisma.appSetting.upsert({ where: { key: "requestPrefix" }, update: { value: "CR" }, create: { key: "requestPrefix", value: "CR", description: "Präfix für Änderungsanträge" } });
  await prisma.appSetting.upsert({ where: { key: "displayTimeZone" }, update: { value: "Europe/Zurich" }, create: { key: "displayTimeZone", value: "Europe/Zurich", description: "Zeitzone der Benutzeroberfläche" } });
}

main().finally(async () => prisma.$disconnect());
