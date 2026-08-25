import { describe, expect, it, vi } from "vitest";
import { generateChangeRequestNumber } from "./numbering";
import { creatorAndApplicant, editableApplicant, formDataToInput, submissionSchema } from "./validation";
import { canEditDraft } from "./authorization";
import { submissionData } from "./submission";
import { buildRequestListQuery } from "./list-query";
const valid = {
  applicantName: "Jeremy Imoberdorf",
  title: "Neue Führung",
  machineTypeIds: ["machine-1"],
  articleNumber: "4711",
  articleDescription: "Kettenführung",
  reasonIds: ["reason-1"],
  otherReasonText: "",
  description: "Technische Begründung",
  version: 1,
};
describe("Antragsaufnahme", () => {
  it("trennt authentifizierten Ersteller und eingegebenen Antragsteller", () => {
    expect(creatorAndApplicant("user-max", " Jeremy Imoberdorf ")).toEqual({
      applicantId: "user-max",
      applicantName: "Jeremy Imoberdorf",
    });
  });
  it("erzeugt jahresbezogene, aufgefüllte Nummern", async () => {
    const tx = {
      changeRequestCounter: {
        upsert: vi.fn().mockResolvedValue({ nextNumber: 8 }),
      },
    };
    expect(await generateChangeRequestNumber(tx, new Date("2026-04-01"))).toBe(
      "CR-2026-007",
    );
    expect(tx.changeRequestCounter.upsert).toHaveBeenCalledOnce();
  });
  it("validiert eine vollständige Einreichung", () =>
    expect(submissionSchema("other").safeParse(valid).success).toBe(true));
  it("akzeptiert einen oder mehrere Maschinentypen", () => {
    expect(submissionSchema().safeParse(valid).success).toBe(true);
    expect(submissionSchema().safeParse({ ...valid, machineTypeIds: ["machine-1", "machine-2"] }).success).toBe(true);
  });
  it("verlangt mindestens einen Maschinentyp", () => expect(submissionSchema().safeParse({ ...valid, machineTypeIds: [] }).success).toBe(false));
  it("weist inaktive oder unbekannte Maschinentypen ab und erlaubt historische explizit", () => {
    expect(submissionSchema(undefined, undefined, new Set(["machine-1"])).safeParse({ ...valid, machineTypeIds: ["inactive"] }).success).toBe(false);
    expect(submissionSchema(undefined, undefined, new Set(["inactive"])).safeParse({ ...valid, machineTypeIds: ["inactive"] }).success).toBe(true);
  });
  it.each([
    ["applicantName", "Bitte einen Antragsteller eingeben."],
    ["articleNumber", "Bitte eine Artikel- oder Baugruppennummer eingeben."],
    [
      "articleDescription",
      "Bitte eine Artikel- oder Baugruppenbezeichnung eingeben.",
    ],
  ])("verlangt %s bei Einreichung", (field, message) => {
    const result = submissionSchema().safeParse({ ...valid, [field]: "" });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.message === message),
    ).toBe(true);
  });
  it("verlangt mindestens einen Grund und Beschreibung", () => {
    const result = submissionSchema().safeParse({
      ...valid,
      reasonIds: [],
      description: "",
    });
    expect(result.success).toBe(false);
  });
  it("verlangt Text bei Sonstiges", () =>
    expect(
      submissionSchema("other").safeParse({ ...valid, reasonIds: ["other"] })
        .success,
    ).toBe(false));
  it("weist inaktive Gründe bei neuen Anträgen ab", () =>
    expect(
      submissionSchema(undefined, new Set(["active"])).safeParse({
        ...valid,
        reasonIds: ["inactive"],
      }).success,
    ).toBe(false));
  it("erlaubt historisch referenzierte inaktive Gründe explizit", () =>
    expect(
      submissionSchema(undefined, new Set(["inactive"])).safeParse({
        ...valid,
        reasonIds: ["inactive"],
      }).success,
    ).toBe(true));
  it("erlaubt Eigentümer und Administratoren bei Entwurf oder Rückweisung", () => {
    const employee = {
      id: "u1",
      name: "U",
      email: "u@x",
      roles: ["EMPLOYEE"] as const,
    };
    expect(canEditDraft(employee, { applicantId: "u1", status: "DRAFT" })).toBe(
      true,
    );
    expect(
      canEditDraft(employee, {
        applicantId: "u1",
        status: "CHANGES_REQUESTED",
      }),
    ).toBe(true);
    expect(canEditDraft(employee, { applicantId: "u2", status: "DRAFT" })).toBe(
      false,
    );
    expect(
      canEditDraft(employee, { applicantId: "u1", status: "UNDER_REVIEW" }),
    ).toBe(false);
  });
  it("initialisiert bei Einreichung zwei getrennte Freigaben", () => {
    const data = submissionData();
    expect(data.request.status).toBe("UNDER_REVIEW");
    expect(data.approvals).toEqual([
      { type: "AVOR", status: "PENDING", cycle: 1 },
      { type: "TECHNICAL", status: "PENDING", cycle: 1 },
    ]);
    expect(data.audit.action).toBe("CHANGE_REQUEST_SUBMITTED");
  });
  it("übersetzt Listenfilter in eine Datenbankabfrage", () => {
    const result = buildRequestListQuery({
      q: "Kette",
      status: "DRAFT",
      page: "2",
      sort: "title",
    });
    expect(result.page).toBe(2);
    expect(result.where).toMatchObject({ status: "DRAFT" });
    expect(result.orderBy).toEqual({ title: "asc" });
  });
  it("erstellt bei Wiedereinreichung zwei neue offene Freigaben im nächsten Zyklus", () => {
    const data = submissionData(new Date("2026-08-25T08:00:00Z"), 3);
    expect(data.approvals).toEqual([
      { type: "AVOR", status: "PENDING", cycle: 3 },
      { type: "TECHNICAL", status: "PENDING", cycle: 3 },
    ]);
  });
  it("filtert und sucht über jede verknüpfte Maschine", () => {
    expect(buildRequestListQuery({ machineTypeId: "m2" }).where).toMatchObject({ machineTypes: { some: { machineTypeId: "m2" } } });
    expect(buildRequestListQuery({ q: "SV-2X" }).where.OR).toContainEqual({ machineTypes: { some: { machineType: { code: { contains: "SV-2X", mode: "insensitive" } } } } });
  });
  it("ändert beim Bearbeiten nur den Antragstellernamen, nicht den Ersteller", () => {
    expect(editableApplicant(" Marc Wyss ")).toEqual({ applicantName: "Marc Wyss" });
    expect(editableApplicant("Marc Wyss")).not.toHaveProperty("applicantId");
  });
  it("übernimmt Platzhaltertexte nicht als Formulardaten", () => {
    const form = new FormData();
    expect(formDataToInput(form).title).toBe("");
    expect(formDataToInput(form).applicantName).toBe("");
  });
  it("dedupliziert doppelt gesendete Maschinen-IDs sicher", () => {
    const form = new FormData();
    form.append("machineTypeIds", "m1");
    form.append("machineTypeIds", "m1");
    form.append("machineTypeIds", "m2");
    expect(formDataToInput(form).machineTypeIds).toEqual(["m1", "m2"]);
  });
  it("filtert Abgeschlossen ausschliesslich auf CLOSED", () => {
    expect(buildRequestListQuery({ view: "closed" }).where).toMatchObject({ status: "CLOSED" });
  });
  it("definiert Offen als alle nicht abgeschlossenen Anträge", () => {
    expect(buildRequestListQuery({ view: "open" }).where).toMatchObject({ status: { not: "CLOSED" } });
  });
  it("verwendet für Meine die bestehende Erstellerzuordnung", () => {
    expect(buildRequestListQuery({ view: "mine" }, "user-1").where).toMatchObject({ applicantId: "user-1" });
  });
});
