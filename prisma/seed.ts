import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { SAMPLE_USERS } from "../src/modules/auth/sample-users";
import { CHANGE_REASONS, MACHINE_TYPES } from "../src/modules/reference-data";

const prisma = new PrismaClient();
const seedDemoUsers = process.env.NODE_ENV !== "production" || process.env.SEED_DEMO_USERS === "true";

async function main() {
  const roleKeys = [
    "EMPLOYEE",
    "AVOR",
    "TECHNICAL",
    "ADMINISTRATOR",
  ] as const;

  for (const key of roleKeys) {
    await prisma.role.upsert({
      where: { key },
      update: {
        name:
          key === "EMPLOYEE"
            ? "Mitarbeitende"
            : key === "TECHNICAL"
              ? "Technik"
              : key === "ADMINISTRATOR"
                  ? "Administration"
                  : "AVOR",
      },
      create: {
        key,
        name:
          key === "EMPLOYEE"
            ? "Mitarbeitende"
            : key === "TECHNICAL"
              ? "Technik"
              : key === "ADMINISTRATOR"
                  ? "Administration"
                  : "AVOR",
      },
    });
  }

  const roles = await prisma.role.findMany();
  const roleByKey = new Map(roles.map((role) => [role.key, role.id]));

  for (const sample of seedDemoUsers ? SAMPLE_USERS : []) {
    const [firstName, ...lastNameParts] = sample.name.split(" ");
    await prisma.user.upsert({
      where: { email: sample.email },
      update: {
        name: sample.name,
        firstName,
        lastName: lastNameParts.join(" "),
        email: sample.email.toLowerCase(),
        passwordHash: await hash("Falu-Dev-2026!", 12),
        active: true,
        roles: {
          deleteMany: {},
          create: sample.roles.map((role) => ({
            roleId: roleByKey.get(role)!,
          })),
        },
      },
      create: {
        id: sample.id,
        name: sample.name,
        firstName,
        lastName: lastNameParts.join(" "),
        email: sample.email.toLowerCase(),
        passwordHash: await hash("Falu-Dev-2026!", 12),
        active: true,
        roles: {
          create: sample.roles.map((role) => ({
            roleId: roleByKey.get(role)!,
          })),
        },
      },
    });
  }

  for (const machine of MACHINE_TYPES) {
    await prisma.machineType.upsert({
      where: { code: machine.code },
      update: machine,
      create: machine,
    });
  }

  for (const reason of CHANGE_REASONS) {
    await prisma.changeReason.upsert({
      where: { key: reason.key },
      update: reason,
      create: reason,
    });
  }

  await prisma.appSetting.upsert({
    where: { key: "defaultCurrency" },
    update: { value: "CHF" },
    create: {
      key: "defaultCurrency",
      value: "CHF",
      description: "Standardwährung",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "requestPrefix" },
    update: { value: "CR" },
    create: {
      key: "requestPrefix",
      value: "CR",
      description: "Präfix für Änderungsanträge",
    },
  });
  await prisma.appSetting.upsert({
    where: { key: "displayTimeZone" },
    update: { value: "Europe/Zurich" },
    create: {
      key: "displayTimeZone",
      value: "Europe/Zurich",
      description: "Zeitzone der Benutzeroberfläche",
    },
  });

  if (!seedDemoUsers) {
    console.log("Produktions-Stammdaten aktualisiert; Demo-Benutzer und Demo-Anträge wurden ausgelassen.");
    return;
  }

  const machineRecords = await prisma.machineType.findMany();
  const reasonRecords = await prisma.changeReason.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const machineId = (code: string) =>
    machineRecords.find((item) => item.code === code)!.id;
  const applicantName = (userId: string) =>
    SAMPLE_USERS.find((user) => user.id === userId)!.name;
  const samples = [
    {
      number: "CR-2026-001",
      title: "Optimierung Kettenführung CB1",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("CB1"),
      description:
        "Die bestehende Kettenführung soll für einen ruhigeren Lauf optimiert werden.",
      status: "DRAFT" as const,
      reasonIndexes: [1, 7],
    },
    {
      number: "CR-2026-002",
      title: "Anpassung Schutzabdeckung CT",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description:
        "Die Schutzabdeckung wird zur Verbesserung der Zugänglichkeit angepasst.",
      status: "UNDER_REVIEW" as const,
      reasonIndexes: [0, 8],
    },
    {
      number: "CR-2026-003",
      title: "Softwareoptimierung Störungsquittierung",
      applicantId: "sample-thomas-technik",
      machineTypeId: machineId("CS-2500"),
      description:
        "Die Bedienlogik für die Störungsquittierung soll verständlicher werden.",
      status: "UNDER_REVIEW" as const,
      reasonIndexes: [4, 9],
    },
    {
      number: "CR-2026-004",
      title: "Verbesserung Materialführung SV-2X",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("SV-2X"),
      description:
        "Die Materialführung wird für einen stabileren Produktionsprozess verbessert.",
      status: "APPROVED_FOR_IMPLEMENTATION" as const,
      reasonIndexes: [1],
    },
    {
      number: "CR-2026-005",
      title: "Anpassung Zugang Servicebereich BL-16",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("BL-16"),
      description: "Der Zugang zum Servicebereich soll angepasst werden.",
      status: "CHANGES_REQUESTED" as const,
      reasonIndexes: [9],
    },
    {
      number: "CR-2026-006",
      title: "Überarbeitung Sensorhalter ABS",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("ABS"),
      description:
        "Der Sensorhalter wurde nach einer Rückweisung überarbeitet.",
      status: "UNDER_REVIEW" as const,
      reasonIndexes: [3],
      approvalCycle: 2,
    },
    {
      number: "CR-2026-007",
      title: "Optimierung Einlaufblech CB1",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("CB1"),
      description: "Technische Ausarbeitung des angepassten Einlaufblechs.",
      status: "AVOR_PRODUCTION_PREPARATION" as const,
      reasonIndexes: [1],
    },
    {
      number: "CR-2026-008",
      title: "Neue Lagerung Förderwelle CT",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description: "Die Lagerung der Förderwelle wird technisch überarbeitet.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [1, 7],
    },
    {
      number: "CR-2026-009",
      title: "Anpassung Kupplungsaufnahme SV-2X",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("SV-2X"),
      description:
        "Die neue Kupplungsaufnahme ist nicht rückwärts austauschbar.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [0],
    },
    {
      number: "CR-2026-010",
      title: "Sicherheitsbügel Baugruppe BL-16",
      applicantId: "sample-thomas-technik",
      machineTypeId: machineId("BL-16"),
      description: "Der Sicherheitsbügel beeinflusst weitere Baugruppen.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [8],
    },
    {
      number: "CR-2026-011",
      title: "Nachrüstsatz Schutzsensor ABS",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("ABS"),
      description:
        "Für ausgelieferte Anlagen wird ein Nachrüstsatz vorgesehen.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [2, 8],
    },
    {
      number: "CR-2026-012",
      title: "Beschaffung Führungsrolle CB1",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("CB1"),
      description: "Einkaufsprüfung ist noch nicht begonnen.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [1],
    },
    {
      number: "CR-2026-013",
      title: "Neuer Sensor CT",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description: "Lieferant wird durch den Einkauf abgeklärt.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [3],
    },
    {
      number: "CR-2026-014",
      title: "Softwareparameter CS-2500",
      applicantId: "sample-thomas-technik",
      machineTypeId: machineId("CS-2500"),
      description: "Keine externe Beschaffung erforderlich.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [4],
    },
    {
      number: "CR-2026-015",
      title: "Kupplungseinsatz SV-2X",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("SV-2X"),
      description: "Lieferant ausgewählt, Bestellung noch offen.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [0],
    },
    {
      number: "CR-2026-016",
      title: "Schutzprofil BL-16",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("BL-16"),
      description: "Bestellung mit zukünftigem Liefertermin ausgelöst.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [8],
    },
    {
      number: "CR-2026-017",
      title: "Nachrüstsatz ABS komplett",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("ABS"),
      description: "Einkaufsprüfung abgeschlossen.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [2],
    },
    {
      number: "CR-2026-018",
      title: "Lagerbock CT verspätet",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description: "Der erwartete Liefertermin ist überschritten.",
      status: "PURCHASING_PROCUREMENT" as const,
      reasonIndexes: [7],
    },
    {
      number: "CR-2026-019",
      title: "Abschlussprüfung Führungsrolle",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("CB1"),
      description: "Beide Abschlussfreigaben sind offen.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [1],
    },
    {
      number: "CR-2026-020",
      title: "Abschlussprüfung Sensorik",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description: "AVOR hat die Abschlussfreigabe bereits erteilt.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [3],
    },
    {
      number: "CR-2026-021",
      title: "Abschluss durch Pflichtaufgabe blockiert",
      applicantId: "sample-thomas-technik",
      machineTypeId: machineId("CS-2500"),
      description: "Eine abschlussrelevante Aufgabe ist noch offen.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [4],
    },
    {
      number: "CR-2026-022",
      title: "Abschlussänderungen historisch",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("SV-2X"),
      description: "Im ersten Abschlusszyklus wurden Änderungen angefordert.",
      status: "APPROVED_FOR_IMPLEMENTATION" as const,
      reasonIndexes: [0],
      finalReviewCycle: 2,
    },
    {
      number: "CR-2026-023",
      title: "Zweite Abschlussprüfung",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("BL-16"),
      description: "Der Antrag befindet sich im zweiten Abschlusszyklus.",
      status: "FINAL_REVIEW" as const,
      reasonIndexes: [8],
      finalReviewCycle: 2,
    },
    {
      number: "CR-2026-024",
      title: "Abgeschlossener Nachrüstsatz",
      applicantId: "sample-max-muster",
      machineTypeId: machineId("ABS"),
      description: "Der Änderungsantrag wurde vollständig abgeschlossen.",
      status: "CLOSED" as const,
      reasonIndexes: [2],
      finalReviewCycle: 1,
    },
    {
      number: "CR-2026-025",
      title: "Administrativ wiedereröffnete Änderung",
      applicantId: "sample-anna-avor",
      machineTypeId: machineId("CT"),
      description:
        "Ein abgeschlossener Antrag wurde administrativ wieder geöffnet.",
      status: "APPROVED_FOR_IMPLEMENTATION" as const,
      reasonIndexes: [7],
      finalReviewCycle: 2,
    },
  ];
  for (const sample of samples) {
    const cycle = (sample as { approvalCycle?: number }).approvalCycle ?? 1;
    const finalReviewCycle =
      (sample as { finalReviewCycle?: number }).finalReviewCycle ?? 1;
    const request = await prisma.changeRequest.upsert({
      where: { number: sample.number },
      update: {
        title: sample.title,
        status: sample.status,
        finalReviewCycle,
        closedAt: null,
        closedById: null,
        applicantName: applicantName(sample.applicantId),
        articleNumber: `ART-${sample.number.slice(-3)}`,
        articleDescription: sample.title,
        description: sample.description,
      },
      create: {
        number: sample.number,
        title: sample.title,
        applicantId: sample.applicantId,
        applicantName: applicantName(sample.applicantId),
        legacyMachineTypeId: sample.machineTypeId,
        articleNumber: `ART-${sample.number.slice(-3)}`,
        articleDescription: sample.title,
        description: sample.description,
        status: sample.status,
        approvalCycle: cycle,
        finalReviewCycle,
        submittedAt: sample.status !== "DRAFT" ? new Date() : null,
        reasons: {
          create: sample.reasonIndexes.map((index) => ({
            changeReasonId: reasonRecords[index].id,
          })),
        },
      },
    });
    await prisma.changeRequestMachineType.upsert({
      where: { changeRequestId_machineTypeId: { changeRequestId: request.id, machineTypeId: sample.machineTypeId } },
      update: {},
      create: { changeRequestId: request.id, machineTypeId: sample.machineTypeId },
    });
    if (sample.status !== "DRAFT")
      for (const type of ["AVOR", "TECHNICAL"] as const)
        await prisma.approval.upsert({
          where: {
            changeRequestId_type_cycle: {
              changeRequestId: request.id,
              type,
              cycle,
            },
          },
          update: {},
          create: { changeRequestId: request.id, type, cycle },
        });
    if (
      (await prisma.auditEvent.count({
        where: { changeRequestId: request.id },
      })) === 0
    )
      await prisma.auditEvent.create({
        data: {
          changeRequestId: request.id,
          userId: sample.applicantId,
          action:
            sample.status === "DRAFT"
              ? "CHANGE_REQUEST_CREATED"
              : "CHANGE_REQUEST_SUBMITTED",
          entityType: "ChangeRequest",
          entityId: request.id,
          summary:
            sample.status === "DRAFT"
              ? "Beispielentwurf erstellt"
              : "Beispielantrag eingereicht",
        },
      });
  }
  const seeded = new Map(
    (
      await prisma.changeRequest.findMany({
        where: { number: { in: samples.map((sample) => sample.number) } },
      })
    ).map((request) => [request.number, request]),
  );
  const decision = async (
    number: string,
    type: "AVOR" | "TECHNICAL",
    status: "APPROVED" | "REJECTED",
    userId: string,
    comment?: string,
    cycle = 1,
  ) =>
    prisma.approval.update({
      where: {
        changeRequestId_type_cycle: {
          changeRequestId: seeded.get(number)!.id,
          type,
          cycle,
        },
      },
      data: { status, decisionUserId: userId, decidedAt: new Date(), comment },
    });
  await decision(
    "CR-2026-003",
    "AVOR",
    "APPROVED",
    "sample-anna-avor",
    "Aus AVOR-Sicht freigegeben.",
  );
  await decision("CR-2026-004", "AVOR", "APPROVED", "sample-anna-avor");
  await decision(
    "CR-2026-004",
    "TECHNICAL",
    "APPROVED",
    "sample-thomas-technik",
  );
  await decision(
    "CR-2026-005",
    "TECHNICAL",
    "REJECTED",
    "sample-thomas-technik",
    "Die Zugänglichkeit muss konstruktiv nochmals geprüft werden.",
  );
  const cycleRequest = seeded.get("CR-2026-006")!;
  for (const type of ["AVOR", "TECHNICAL"] as const)
    await prisma.approval.upsert({
      where: {
        changeRequestId_type_cycle: {
          changeRequestId: cycleRequest.id,
          type,
          cycle: 1,
        },
      },
      update: {},
      create: { changeRequestId: cycleRequest.id, type, cycle: 1 },
    });
  await decision(
    "CR-2026-006",
    "AVOR",
    "APPROVED",
    "sample-anna-avor",
    undefined,
    1,
  );
  await decision(
    "CR-2026-006",
    "TECHNICAL",
    "REJECTED",
    "sample-thomas-technik",
    "Sensorposition korrigieren.",
    1,
  );
  for (const number of [
    "CR-2026-007",
    "CR-2026-008",
    "CR-2026-009",
    "CR-2026-010",
    "CR-2026-011",
  ]) {
    await decision(number, "AVOR", "APPROVED", "sample-anna-avor");
    await decision(number, "TECHNICAL", "APPROVED", "sample-thomas-technik");
  }
  const reviewBase = {
    operatingSafety: "YES" as const,
    interchangeability: "YES" as const,
    affectsOthers: "NO" as const,
    existingArticlesUsable: "YES" as const,
    nextSteps: "Zeichnungen und Stücklisten gemäss Freigabe aktualisieren.",
    implementationNotes:
      "Umsetzung mit der nächsten regulären Konstruktionsrevision.",
    sparePartsCatalogueUpdated: "NOT_RELEVANT" as const,
    manufacturingDocsUpdated: "YES" as const,
  };
  await prisma.technicalReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-007")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-007")!.id,
      operatingSafety: "YES",
      nextSteps: "Versuchsaufbau vorbereiten.",
    },
  });
  await prisma.technicalReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-008")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-008")!.id,
      ...reviewBase,
      completed: true,
      completedById: "sample-thomas-technik",
      completedAt: new Date(),
    },
  });
  await prisma.technicalReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-009")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-009")!.id,
      ...reviewBase,
      interchangeability: "NO",
      interchangeabilityComment:
        "Bestehende Kupplungen benötigen einen Adapter und sind nicht direkt austauschbar.",
      completed: true,
      completedById: "sample-thomas-technik",
      completedAt: new Date(),
    },
  });
  await prisma.technicalReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-010")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-010")!.id,
      ...reviewBase,
      affectsOthers: "YES",
      affectedItemsExplanation:
        "Schutzhaube und Haltewinkel der Baugruppe müssen ebenfalls angepasst werden.",
      completed: true,
      completedById: "sample-thomas-technik",
      completedAt: new Date(),
    },
  });
  await prisma.technicalReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-011")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-011")!.id,
      ...reviewBase,
      completed: true,
      completedById: "sample-thomas-technik",
      completedAt: new Date(),
    },
  });
  const avorBase = {
    stockNeedsAction: "NO" as const,
    purchaseOrdersNeedUpdate: "NO" as const,
    productionOrdersNeedUpdate: "NO" as const,
    deliveredMachinesNeedParts: "NO" as const,
    currency: "CHF",
    remarks: "AVOR-Auswirkungen geprüft.",
  };
  await prisma.avorImpactReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-007")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-007")!.id,
      stockNeedsAction: "NO",
      remarks: "Lagerbestand wird noch geprüft.",
    },
  });
  const purchasingExamples = [
    {
      number: "CR-2026-013",
      data: {
        purchasingRequired: true,
        supplier: "Lieferant wird evaluiert",
        supplierNotes: "Angebote bei zwei Lieferanten angefragt.",
        orderRequired: null,
        notes: "Rückmeldung bis Ende Woche erwartet.",
      },
    },
    {
      number: "CR-2026-014",
      data: {
        purchasingRequired: false,
        orderRequired: false,
        completed: true,
        completedById: "sample-petra-einkauf",
        completedAt: new Date(),
      },
    },
    {
      number: "CR-2026-015",
      data: {
        purchasingRequired: true,
        supplier: "Muster Komponenten AG",
        orderRequired: true,
        orderCompleted: false,
        notes: "Bestellfreigabe ausstehend.",
      },
    },
    {
      number: "CR-2026-016",
      data: {
        purchasingRequired: true,
        supplier: "Profiltechnik Schweiz AG",
        orderRequired: true,
        orderCompleted: true,
        orderNumber: "PO-2026-0816",
        orderDate: new Date("2026-08-16"),
        orderedById: "sample-petra-einkauf",
        expectedDeliveryDate: new Date("2026-09-15"),
      },
    },
    {
      number: "CR-2026-017",
      data: {
        purchasingRequired: true,
        supplier: "Sensorik Muster AG",
        orderRequired: true,
        orderCompleted: true,
        orderNumber: "PO-2026-0802",
        orderDate: new Date("2026-08-02"),
        orderedById: "sample-petra-einkauf",
        expectedDeliveryDate: new Date("2026-08-25"),
        completed: true,
        completedById: "sample-petra-einkauf",
        completedAt: new Date(),
      },
    },
    {
      number: "CR-2026-018",
      data: {
        purchasingRequired: true,
        supplier: "Gussteile Beispiel AG",
        orderRequired: true,
        orderCompleted: false,
        orderNumber: "PO-2026-0711",
        expectedDeliveryDate: new Date("2026-08-01"),
        notes: "Lieferant wurde wegen Terminverzug kontaktiert.",
      },
    },
  ];
  await prisma.purchasingReview.deleteMany({
    where: { changeRequestId: seeded.get("CR-2026-012")!.id },
  });
  for (const example of purchasingExamples)
    await prisma.purchasingReview.upsert({
      where: { changeRequestId: seeded.get(example.number)!.id },
      update: example.data,
      create: {
        changeRequestId: seeded.get(example.number)!.id,
        ...example.data,
      },
    });
  await prisma.avorImpactReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-008")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-008")!.id,
      ...avorBase,
      completed: true,
      completedById: "sample-anna-avor",
      completedAt: new Date(),
    },
  });
  await prisma.avorImpactReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-009")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-009")!.id,
      ...avorBase,
      stockNeedsAction: "YES",
      stockActionExplanation:
        "Vorhandene Kupplungsaufnahmen nacharbeiten und Restbestand umbuchen.",
      productionOrdersNeedUpdate: "YES",
      productionOrderExplanation:
        "Zwei gerüstete Aufträge auf den neuen Zeichnungsstand umstellen.",
      completed: true,
      completedById: "sample-anna-avor",
      completedAt: new Date(),
    },
  });
  await prisma.avorImpactReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-010")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-010")!.id,
      ...avorBase,
      purchaseOrdersNeedUpdate: "YES",
      purchaseOrderExplanation:
        "Offene Bestellung der Haltewinkel auf neue Revision ändern.",
      completed: true,
      completedById: "sample-anna-avor",
      completedAt: new Date(),
    },
  });
  await prisma.avorImpactReview.upsert({
    where: { changeRequestId: seeded.get("CR-2026-011")!.id },
    update: {},
    create: {
      changeRequestId: seeded.get("CR-2026-011")!.id,
      ...avorBase,
      deliveredMachinesNeedParts: "YES",
      deliveredMachinesExplanation:
        "Nachrüstsätze für betroffene ausgelieferte Anlagen bereitstellen.",
      validFromMachineNumber: "11850",
      estimatedAdditionalCosts: 1250,
      completed: true,
      completedById: "sample-anna-avor",
      completedAt: new Date(),
    },
  });
  const taskExamples = [
    {
      request: "CR-2026-004",
      title: "Zeichnung aktualisieren",
      responsibleUserId: "sample-thomas-technik",
      department: "TECHNICAL" as const,
      dueDate: new Date("2026-08-28"),
      priority: "HIGH" as const,
      status: "OPEN" as const,
      requiredForClosure: true,
    },
    {
      request: "CR-2026-007",
      title: "Lagerbestand disponieren",
      responsibleUserId: "sample-anna-avor",
      department: "AVOR" as const,
      dueDate: new Date("2026-08-26"),
      priority: "NORMAL" as const,
      status: "IN_PROGRESS" as const,
      requiredForClosure: true,
    },
    {
      request: "CR-2026-016",
      title: "Liefertermin bestätigen",
      responsibleUserId: "sample-petra-einkauf",
      department: "PURCHASING" as const,
      dueDate: new Date("2026-08-22"),
      priority: "HIGH" as const,
      status: "OPEN" as const,
      requiredForClosure: true,
    },
    {
      request: "CR-2026-009",
      title: "Montageanweisung prüfen",
      responsibleUserId: "sample-max-muster",
      department: "PRODUCTION_ASSEMBLY" as const,
      dueDate: new Date("2026-08-01"),
      priority: "NORMAL" as const,
      status: "OPEN" as const,
      requiredForClosure: true,
    },
    {
      request: "CR-2026-010",
      title: "Freigabe Sicherheitssteuerung",
      responsibleUserId: "sample-thomas-technik",
      department: "AUTOMATION_SOFTWARE" as const,
      dueDate: new Date("2026-08-24"),
      priority: "CRITICAL" as const,
      status: "BLOCKED" as const,
      requiredForClosure: true,
    },
    {
      request: "CR-2026-008",
      title: "Stückliste abgleichen",
      responsibleUserId: "sample-anna-avor",
      department: "AVOR" as const,
      dueDate: new Date("2026-08-15"),
      priority: "NORMAL" as const,
      status: "DONE" as const,
      requiredForClosure: true,
      completedById: "sample-anna-avor",
      completedAt: new Date("2026-08-14"),
    },
    {
      request: "CR-2026-011",
      title: "Kundeninformation vorbereiten",
      responsibleUserId: "sample-max-muster",
      department: "SERVICE" as const,
      dueDate: null,
      priority: "LOW" as const,
      status: "OPEN" as const,
      requiredForClosure: false,
    },
    {
      request: "CR-2026-017",
      title: "Verkaufsunterlagen aktualisieren",
      responsibleUserId: "sample-max-muster",
      department: "SALES" as const,
      dueDate: new Date("2026-09-01"),
      priority: "LOW" as const,
      status: "OPEN" as const,
      requiredForClosure: false,
    },
    {
      request: "CR-2026-021",
      title: "Abschlussdokumentation fertigstellen",
      responsibleUserId: "sample-thomas-technik",
      department: "TECHNICAL" as const,
      dueDate: new Date("2026-08-25"),
      priority: "HIGH" as const,
      status: "OPEN" as const,
      requiredForClosure: true,
    },
  ];
  for (const example of taskExamples) {
    const changeRequestId = seeded.get(example.request)!.id;
    const existing = await prisma.task.findFirst({
      where: { changeRequestId, title: example.title },
    });
    const data = {
      ...example,
      request: undefined,
      changeRequestId,
      createdById: "sample-admin-falu",
      description: `Beispielaufgabe für ${example.request}.`,
    };
    if (existing)
      await prisma.task.update({ where: { id: existing.id }, data });
    else await prisma.task.create({ data });
  }
  for (const number of [
    "CR-2026-019",
    "CR-2026-020",
    "CR-2026-021",
    "CR-2026-023",
    "CR-2026-024",
  ]) {
    const changeRequestId = seeded.get(number)!.id;
    await prisma.technicalReview.upsert({
      where: { changeRequestId },
      update: {
        completed: true,
        completedById: "sample-thomas-technik",
        completedAt: new Date(),
      },
      create: {
        changeRequestId,
        ...reviewBase,
        completed: true,
        completedById: "sample-thomas-technik",
        completedAt: new Date(),
      },
    });
    await prisma.avorImpactReview.upsert({
      where: { changeRequestId },
      update: {
        completed: true,
        completedById: "sample-anna-avor",
        completedAt: new Date(),
      },
      create: {
        changeRequestId,
        ...avorBase,
        completed: true,
        completedById: "sample-anna-avor",
        completedAt: new Date(),
      },
    });
    await prisma.purchasingReview.upsert({
      where: { changeRequestId },
      update: {
        purchasingRequired: false,
        orderRequired: false,
        completed: true,
        completedById: "sample-petra-einkauf",
        completedAt: new Date(),
      },
      create: {
        changeRequestId,
        purchasingRequired: false,
        orderRequired: false,
        completed: true,
        completedById: "sample-petra-einkauf",
        completedAt: new Date(),
      },
    });
  }
  const seedFinalApproval = async (
    number: string,
    cycle: number,
    type: "AVOR" | "TECHNICAL",
    approvedById: string,
  ) =>
    prisma.finalApproval.upsert({
      where: {
        changeRequestId_cycle_type: {
          changeRequestId: seeded.get(number)!.id,
          cycle,
          type,
        },
      },
      update: {},
      create: {
        changeRequestId: seeded.get(number)!.id,
        cycle,
        type,
        approvedById,
        comment: "Fiktive Abschlussfreigabe.",
      },
    });
  await seedFinalApproval("CR-2026-020", 1, "AVOR", "sample-anna-avor");
  await seedFinalApproval("CR-2026-022", 1, "AVOR", "sample-anna-avor");
  await seedFinalApproval("CR-2026-023", 1, "AVOR", "sample-anna-avor");
  await seedFinalApproval("CR-2026-024", 1, "AVOR", "sample-anna-avor");
  await seedFinalApproval(
    "CR-2026-024",
    1,
    "TECHNICAL",
    "sample-thomas-technik",
  );
  await seedFinalApproval("CR-2026-025", 1, "AVOR", "sample-anna-avor");
  await seedFinalApproval(
    "CR-2026-025",
    1,
    "TECHNICAL",
    "sample-thomas-technik",
  );
  await prisma.changeRequest.update({
    where: { number: "CR-2026-024" },
    data: {
      closedAt: new Date("2026-08-18T12:32:00Z"),
      closedById: "sample-thomas-technik",
      finalComment: "Umsetzung und Beschaffung sind vollständig abgeschlossen.",
    },
  });
  for (const historical of [
    {
      number: "CR-2026-022",
      action: "FINAL_REVIEW_CHANGES_REQUIRED",
      summary:
        "Thomas Technik hat weitere Änderungen angefordert. Grund: Dokumentation ergänzen.",
    },
    {
      number: "CR-2026-025",
      action: "FINAL_REVIEW_REOPENED",
      summary:
        "Admin Falu hat den abgeschlossenen Änderungsantrag erneut geöffnet. Grund: Nachtrag erforderlich.",
    },
  ])
    if (
      (await prisma.auditEvent.count({
        where: {
          changeRequestId: seeded.get(historical.number)!.id,
          action: historical.action,
        },
      })) === 0
    )
      await prisma.auditEvent.create({
        data: {
          changeRequestId: seeded.get(historical.number)!.id,
          userId: historical.number.endsWith("22")
            ? "sample-thomas-technik"
            : "sample-admin-falu",
          action: historical.action,
          entityType: "ChangeRequest",
          entityId: seeded.get(historical.number)!.id,
          summary: historical.summary,
        },
      });
  await prisma.changeRequestCounter.upsert({
    where: { year: 2026 },
    update: { nextNumber: { set: 26 } },
    create: { year: 2026, nextNumber: 26 },
  });
}

main().finally(async () => prisma.$disconnect());
