import { db } from "@/server/db/client";
import { getWritingProvider, type WritingProvider, type WritingRequest } from "@/modules/ai/provider";
import { queueCompletedRequestBroadcast } from "./workflow";
import { sendNotifications } from "./service-core";

const TIMEOUT_MS = 20_000;

type SummarySource = {
  number: string;
  title: string;
  applicantName: string;
  description: string;
  otherReasonText: string | null;
  finalComment: string | null;
  closedAt: Date | null;
  machineTypes: Array<{ machineType: { code: string } }>;
  reasons: Array<{ changeReason: { label: string } }>;
  technicalReview: { implementationNotes: string | null; nextSteps: string | null } | null;
  avorImpactReview: { remarks: string | null; stockActionExplanation: string | null; purchaseOrderExplanation: string | null; productionOrderExplanation: string | null; deliveredMachinesExplanation: string | null; validFromMachineNumber: string | null } | null;
  purchasingReview: { supplierNotes: string | null; notes: string | null; orderNumber: string | null } | null;
  tasks: Array<{ title: string; description: string | null }>;
};

export function completionSummaryRequest(source: SummarySource): WritingRequest {
  const lines = [
    `Antragsnummer: ${source.number}`,
    `Titel: ${source.title}`,
    `Antragsteller: ${source.applicantName}`,
    `Maschinentypen: ${source.machineTypes.map(({ machineType }) => machineType.code).join(", ")}`,
    `Ursprüngliche Beschreibung: ${source.description}`,
    `Änderungsgründe: ${source.reasons.map(({ changeReason }) => changeReason.label).join(", ")}`,
    source.otherReasonText ? `Weiterer Grund: ${source.otherReasonText}` : "",
    source.finalComment ? `Interner Abschlussbericht: ${source.finalComment}` : "",
    source.technicalReview?.implementationNotes ? `Technische Umsetzungsnotizen: ${source.technicalReview.implementationNotes}` : "",
    source.technicalReview?.nextSteps ? `Dokumentierte technische Schritte: ${source.technicalReview.nextSteps}` : "",
    source.avorImpactReview?.remarks ? `AVOR-Bemerkungen: ${source.avorImpactReview.remarks}` : "",
    source.avorImpactReview?.stockActionExplanation ? `Lagerauswirkung: ${source.avorImpactReview.stockActionExplanation}` : "",
    source.avorImpactReview?.purchaseOrderExplanation ? `Bestellauswirkung: ${source.avorImpactReview.purchaseOrderExplanation}` : "",
    source.avorImpactReview?.productionOrderExplanation ? `Produktionsauswirkung: ${source.avorImpactReview.productionOrderExplanation}` : "",
    source.avorImpactReview?.deliveredMachinesExplanation ? `Auswirkung auf ausgelieferte Maschinen: ${source.avorImpactReview.deliveredMachinesExplanation}` : "",
    source.avorImpactReview?.validFromMachineNumber ? `Gültig ab Maschinennummer: ${source.avorImpactReview.validFromMachineNumber}` : "",
    source.purchasingReview?.supplierNotes ? `Lieferantenhinweise: ${source.purchasingReview.supplierNotes}` : "",
    source.purchasingReview?.notes ? `Einkaufsnotizen: ${source.purchasingReview.notes}` : "",
    source.purchasingReview?.orderNumber ? `Bestellnummer: ${source.purchasingReview.orderNumber}` : "",
    source.tasks.length ? `Erledigte Aufgaben: ${source.tasks.map((task) => `${task.title}${task.description ? ` – ${task.description}` : ""}`).join("; ")}` : "",
    source.closedAt ? `Abschlussdatum: ${source.closedAt.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}` : "",
  ].filter(Boolean);
  return {
    fieldLabel: "Unternehmensweite Abschlusszusammenfassung",
    notes: lines.join("\n"),
    context: [
      "Erstelle 3–5 kurze deutsche Sätze für alle Mitarbeitenden.",
      "Beschreibe nur dokumentierte Fakten: was und warum geändert wurde, betroffene Maschine/Produkt, Umsetzung sowie dokumentierte Folgen oder neuen Standard.",
      "Erfinde nichts, leite keine undokumentierten technischen Details ab und behaupte keine nicht dokumentierten Tests oder Ergebnisse.",
      "Fehlende Angaben werden ausgelassen. Gib ausschließlich die Zusammenfassung aus.",
    ].join(" "),
  };
}

const summarySelect = {
  number: true, title: true, applicantName: true, description: true, otherReasonText: true, finalComment: true, closedAt: true,
  machineTypes: { select: { machineType: { select: { code: true } } }, orderBy: { machineType: { code: "asc" as const } } },
  reasons: { select: { changeReason: { select: { label: true } } } },
  technicalReview: { select: { implementationNotes: true, nextSteps: true } },
  avorImpactReview: { select: { remarks: true, stockActionExplanation: true, purchaseOrderExplanation: true, productionOrderExplanation: true, deliveredMachinesExplanation: true, validFromMachineNumber: true } },
  purchasingReview: { select: { supplierNotes: true, notes: true, orderNumber: true } },
  tasks: { where: { status: "DONE" as const }, select: { title: true, description: true } },
} as const;

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race<T>([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("AI summary timed out")), TIMEOUT_MS))]);
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Unbekannter AI-Fehler").replace(/\b(sk-|sess-)[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}

export async function generateAndBroadcastCompletionSummary(requestId: string, options: { provider?: WritingProvider | null } = {}) {
  const request = await db.changeRequest.findUnique({ where: { id: requestId }, select: { status: true, aiCompletionSummary: true, ...summarySelect } });
  if (!request || request.status !== "CLOSED") return { status: "skipped" as const, sent: 0 };
  let summary = request.aiCompletionSummary;
  if (!summary) {
    const provider = options.provider === undefined ? getWritingProvider() : options.provider;
    if (!provider) {
      const message = "AI-Anbieter für Abschlusszusammenfassung ist nicht konfiguriert.";
      await recordFailure(requestId, message);
      return { status: "failed" as const, sent: 0 };
    }
    try {
      summary = (await withTimeout(provider.formulate(completionSummaryRequest(request)))).trim();
      if (!summary) throw new Error("AI lieferte keine Abschlusszusammenfassung.");
      await db.$transaction(async (tx) => {
        const stored = await tx.changeRequest.updateMany({ where: { id: requestId, status: "CLOSED", aiCompletionSummary: null }, data: { aiCompletionSummary: summary, aiSummaryGeneratedAt: new Date(), aiSummaryError: null } });
        if (stored.count === 1) await tx.auditEvent.create({ data: { changeRequestId: requestId, action: "AI_COMPLETION_SUMMARY_GENERATED", entityType: "ChangeRequest", entityId: requestId, summary: "Die unternehmensweite AI-Abschlusszusammenfassung wurde automatisch erstellt." } });
      });
    } catch (error) {
      await recordFailure(requestId, safeError(error));
      return { status: "failed" as const, sent: 0 };
    }
  }
  const ids = await db.$transaction((tx) => queueCompletedRequestBroadcast(tx, requestId));
  await sendNotifications(ids);
  return { status: "completed" as const, sent: new Set(ids).size };
}

async function recordFailure(requestId: string, message: string) {
  console.error("AI completion summary failed", { requestId, message });
  await db.$transaction(async (tx) => {
    await tx.changeRequest.updateMany({ where: { id: requestId, status: "CLOSED", aiCompletionSummary: null }, data: { aiSummaryError: message } });
    await tx.auditEvent.create({ data: { changeRequestId: requestId, action: "AI_COMPLETION_SUMMARY_FAILED", entityType: "ChangeRequest", entityId: requestId, summary: "Die automatische AI-Abschlusszusammenfassung konnte nicht erstellt werden.", details: { error: message } } });
  });
}

export async function retryMissingCompletionSummaries(options: { provider?: WritingProvider | null } = {}) {
  const requests = await db.changeRequest.findMany({ where: { status: "CLOSED" }, select: { id: true } });
  const results = [];
  for (const request of requests) results.push(await generateAndBroadcastCompletionSummary(request.id, options));
  return results;
}
