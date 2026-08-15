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

  const machineRecords = await prisma.machineType.findMany();
  const reasonRecords = await prisma.changeReason.findMany({ orderBy: { sortOrder: "asc" } });
  const machineId = (code: string) => machineRecords.find((item) => item.code === code)!.id;
  const samples = [
    { number: "CR-2026-001", title: "Optimierung Kettenführung CB1", applicantId: "sample-max-muster", machineTypeId: machineId("CB1"), description: "Die bestehende Kettenführung soll für einen ruhigeren Lauf optimiert werden.", status: "DRAFT" as const, reasonIndexes: [1, 7] },
    { number: "CR-2026-002", title: "Anpassung Schutzabdeckung CT", applicantId: "sample-anna-avor", machineTypeId: machineId("CT"), description: "Die Schutzabdeckung wird zur Verbesserung der Zugänglichkeit angepasst.", status: "UNDER_REVIEW" as const, reasonIndexes: [0, 8] },
    { number: "CR-2026-003", title: "Softwareoptimierung Störungsquittierung", applicantId: "sample-thomas-technik", machineTypeId: machineId("CS-2500"), description: "Die Bedienlogik für die Störungsquittierung soll verständlicher werden.", status: "UNDER_REVIEW" as const, reasonIndexes: [4, 9] },
  ];
  for (const sample of samples) {
    const request = await prisma.changeRequest.upsert({
      where: { number: sample.number },
      update: { title: sample.title, description: sample.description },
      create: { number: sample.number, title: sample.title, applicantId: sample.applicantId, machineTypeId: sample.machineTypeId, description: sample.description, status: sample.status, submittedAt: sample.status === "UNDER_REVIEW" ? new Date() : null, reasons: { create: sample.reasonIndexes.map((index) => ({ changeReasonId: reasonRecords[index].id })) } },
    });
    if (sample.status === "UNDER_REVIEW") for (const type of ["AVOR", "TECHNICAL"] as const) await prisma.approval.upsert({ where: { changeRequestId_type_cycle: { changeRequestId: request.id, type, cycle: 1 } }, update: {}, create: { changeRequestId: request.id, type, cycle: 1 } });
    if (await prisma.auditEvent.count({ where: { changeRequestId: request.id } }) === 0) await prisma.auditEvent.create({ data: { changeRequestId: request.id, userId: sample.applicantId, action: sample.status === "DRAFT" ? "CHANGE_REQUEST_CREATED" : "CHANGE_REQUEST_SUBMITTED", entityType: "ChangeRequest", entityId: request.id, summary: sample.status === "DRAFT" ? "Beispielentwurf erstellt" : "Beispielantrag eingereicht" } });
  }
  await prisma.changeRequestCounter.upsert({ where: { year: 2026 }, update: { nextNumber: { set: 4 } }, create: { year: 2026, nextNumber: 4 } });
}

main().finally(async () => prisma.$disconnect());
