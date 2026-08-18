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
    { number: "CR-2026-004", title: "Verbesserung Materialführung SV-2X", applicantId: "sample-max-muster", machineTypeId: machineId("SV-2X"), description: "Die Materialführung wird für einen stabileren Produktionsprozess verbessert.", status: "APPROVED_FOR_IMPLEMENTATION" as const, reasonIndexes: [1] },
    { number: "CR-2026-005", title: "Anpassung Zugang Servicebereich BL-16", applicantId: "sample-max-muster", machineTypeId: machineId("BL-16"), description: "Der Zugang zum Servicebereich soll angepasst werden.", status: "CHANGES_REQUESTED" as const, reasonIndexes: [9] },
    { number: "CR-2026-006", title: "Überarbeitung Sensorhalter ABS", applicantId: "sample-max-muster", machineTypeId: machineId("ABS"), description: "Der Sensorhalter wurde nach einer Rückweisung überarbeitet.", status: "UNDER_REVIEW" as const, reasonIndexes: [3], approvalCycle: 2 },
  ];
  for (const sample of samples) {
    const cycle = (sample as { approvalCycle?: number }).approvalCycle ?? 1;
    const request = await prisma.changeRequest.upsert({
      where: { number: sample.number },
      update: { title: sample.title, description: sample.description },
      create: { number: sample.number, title: sample.title, applicantId: sample.applicantId, machineTypeId: sample.machineTypeId, description: sample.description, status: sample.status, approvalCycle: cycle, submittedAt: sample.status !== "DRAFT" ? new Date() : null, reasons: { create: sample.reasonIndexes.map((index) => ({ changeReasonId: reasonRecords[index].id })) } },
    });
    if (sample.status !== "DRAFT") for (const type of ["AVOR", "TECHNICAL"] as const) await prisma.approval.upsert({ where: { changeRequestId_type_cycle: { changeRequestId: request.id, type, cycle } }, update: {}, create: { changeRequestId: request.id, type, cycle } });
    if (await prisma.auditEvent.count({ where: { changeRequestId: request.id } }) === 0) await prisma.auditEvent.create({ data: { changeRequestId: request.id, userId: sample.applicantId, action: sample.status === "DRAFT" ? "CHANGE_REQUEST_CREATED" : "CHANGE_REQUEST_SUBMITTED", entityType: "ChangeRequest", entityId: request.id, summary: sample.status === "DRAFT" ? "Beispielentwurf erstellt" : "Beispielantrag eingereicht" } });
  }
  const seeded = new Map((await prisma.changeRequest.findMany({ where: { number: { in: samples.map((sample) => sample.number) } } })).map((request) => [request.number, request]));
  const decision = async (number: string, type: "AVOR" | "TECHNICAL", status: "APPROVED" | "REJECTED", userId: string, comment?: string, cycle = 1) => prisma.approval.update({ where: { changeRequestId_type_cycle: { changeRequestId: seeded.get(number)!.id, type, cycle } }, data: { status, decisionUserId: userId, decidedAt: new Date(), comment } });
  await decision("CR-2026-003", "AVOR", "APPROVED", "sample-anna-avor", "Aus AVOR-Sicht freigegeben.");
  await decision("CR-2026-004", "AVOR", "APPROVED", "sample-anna-avor"); await decision("CR-2026-004", "TECHNICAL", "APPROVED", "sample-thomas-technik");
  await decision("CR-2026-005", "TECHNICAL", "REJECTED", "sample-thomas-technik", "Die Zugänglichkeit muss konstruktiv nochmals geprüft werden.");
  const cycleRequest = seeded.get("CR-2026-006")!;
  for (const type of ["AVOR", "TECHNICAL"] as const) await prisma.approval.upsert({ where: { changeRequestId_type_cycle: { changeRequestId: cycleRequest.id, type, cycle: 1 } }, update: {}, create: { changeRequestId: cycleRequest.id, type, cycle: 1 } });
  await decision("CR-2026-006", "AVOR", "APPROVED", "sample-anna-avor", undefined, 1); await decision("CR-2026-006", "TECHNICAL", "REJECTED", "sample-thomas-technik", "Sensorposition korrigieren.", 1);
  await prisma.changeRequestCounter.upsert({ where: { year: 2026 }, update: { nextNumber: { set: 7 } }, create: { year: 2026, nextNumber: 7 } });
}

main().finally(async () => prisma.$disconnect());
