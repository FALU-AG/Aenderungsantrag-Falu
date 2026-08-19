import { describe, expect, it } from "vitest";
import {
  canEditPurchasingReview,
  isDeliveryOverdue,
  purchasingCompletionSchema,
  purchasingDraftSchema,
  purchasingReopenedMetadata,
  purchasingAudit,
  statusAfterPurchasingCompletion,
} from "./domain";
const complete = {
  purchasingRequired: true,
  supplier: "Muster AG",
  supplierNotes: "",
  orderRequired: true,
  orderCompleted: true,
  orderNumber: "B-42",
  orderDate: "2026-08-19",
  expectedDeliveryDate: "",
  notes: "",
};
describe("Einkaufsprüfung", () => {
  it("erlaubt Teilstände", () =>
    expect(
      purchasingDraftSchema.safeParse({
        ...complete,
        purchasingRequired: null,
        supplier: "",
      }).success,
    ).toBe(true));
  it("verlangt Lieferant und Bestellstatus bedingt", () => {
    expect(
      purchasingCompletionSchema.safeParse({ ...complete, supplier: "" })
        .success,
    ).toBe(false);
    expect(
      purchasingCompletionSchema.safeParse({
        ...complete,
        orderCompleted: false,
      }).success,
    ).toBe(false);
  });
  it("erlaubt nur Einkauf/Admin in der Einkaufsphase", () => {
    expect(
      canEditPurchasingReview(
        { roles: ["EMPLOYEE"] },
        "PURCHASING_PROCUREMENT",
      ),
    ).toBe(false);
    expect(
      canEditPurchasingReview(
        { roles: ["AVOR"] },
        "PURCHASING_PROCUREMENT",
      ),
    ).toBe(true);
    expect(
      canEditPurchasingReview({ roles: ["ADMINISTRATOR"] }, "FINAL_REVIEW"),
    ).toBe(true);
    expect(canEditPurchasingReview({ roles: ["AVOR"] }, "CLOSED")).toBe(
      false,
    );
  });
  it("erkennt überfällige offene Bestellungen", () =>
    expect(isDeliveryOverdue(new Date("2020-01-01"), false)).toBe(true));
  it("öffnet Abschlussmetadaten erneut", () =>
    expect(purchasingReopenedMetadata()).toEqual({
      completed: false,
      completedById: null,
      completedAt: null,
    }));
  it("wechselt beim Abschluss genau aus der Einkaufsphase weiter", () => {
    expect(
      statusAfterPurchasingCompletion("PURCHASING_PROCUREMENT", true),
    ).toBe("FINAL_REVIEW");
    expect(statusAfterPurchasingCompletion("FINAL_REVIEW", true)).toBe(
      "FINAL_REVIEW",
    );
    expect(
      statusAfterPurchasingCompletion("PURCHASING_PROCUREMENT", false),
    ).toBe("PURCHASING_PROCUREMENT");
  });
  it("erzeugt Auditdaten für Bestellung und Wiederöffnung", () => {
    expect(purchasingAudit("Petra Einkauf", "ORDER_PLACED").action).toBe(
      "PURCHASING_REVIEW_ORDER_PLACED",
    );
    expect(
      purchasingAudit("Petra Einkauf", "REOPENED", "Korrektur").summary,
    ).toContain("Korrektur");
  });
});
