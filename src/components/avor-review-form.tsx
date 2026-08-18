"use client";
import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { AssistedTextField } from "@/components/assisted-text-field";
import {
  reopenAvorReview,
  saveAvorReview,
  type AvorActionState,
} from "@/modules/avor-review/actions";
import {
  IMPACT_LABELS,
  type ImpactAnswerKey,
} from "@/modules/avor-review/domain";
type Review = {
  stockNeedsAction: ImpactAnswerKey | null;
  stockActionExplanation: string | null;
  purchaseOrdersNeedUpdate: ImpactAnswerKey | null;
  purchaseOrderExplanation: string | null;
  productionOrdersNeedUpdate: ImpactAnswerKey | null;
  productionOrderExplanation: string | null;
  deliveredMachinesNeedParts: ImpactAnswerKey | null;
  deliveredMachinesExplanation: string | null;
  validFromMachineNumber: string | null;
  estimatedAdditionalCosts: string | null;
  currency: string;
  remarks: string | null;
  completed: boolean;
  completedBy?: { name: string } | null;
  completedAt?: string | null;
};
const initial: AvorActionState = {};
export function AvorReviewForm({
  requestId,
  review,
  editable,
  available,
}: {
  requestId: string;
  review: Review | null;
  editable: boolean;
  available: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveAvorReview.bind(null, requestId),
    initial,
  );
  const [reopenState, reopenAction, reopening] = useActionState(
    reopenAvorReview.bind(null, requestId),
    initial,
  );
  const [showReopen, setShowReopen] = useState(false);
  const [answers, setAnswers] = useState<
    Record<string, ImpactAnswerKey | null>
  >({
    stockNeedsAction: review?.stockNeedsAction ?? null,
    purchaseOrdersNeedUpdate: review?.purchaseOrdersNeedUpdate ?? null,
    productionOrdersNeedUpdate: review?.productionOrdersNeedUpdate ?? null,
    deliveredMachinesNeedParts: review?.deliveredMachinesNeedParts ?? null,
  });
  const locked = !editable || Boolean(review?.completed);
  const status = !review
    ? "Nicht begonnen"
    : review.completed
      ? "Abgeschlossen"
      : "In Bearbeitung";
  const error = (n: string) => state.errors?.[n]?.[0];
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Status AVOR-Prüfung
          </p>
          <p className="mt-1 font-semibold">{status}</p>
          {review?.completed && (
            <p className="mt-1 text-sm text-slate-500">
              Abgeschlossen von {review.completedBy?.name ?? "–"}
              {review.completedAt ? ` · ${review.completedAt}` : ""}
            </p>
          )}
        </div>
        {review?.completed && editable && (
          <button
            onClick={() => setShowReopen(true)}
            className="rounded-md border px-3 py-2 text-sm font-semibold"
          >
            AVOR-Prüfung erneut öffnen
          </button>
        )}
      </Card>
      {!available && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Die AVOR-Prüfung wird nach der AVOR- und Technikfreigabe verfügbar.
        </div>
      )}
      <form action={action} className="space-y-5">
        <Section title="A. Lagerbestand">
          <Question
            name="stockNeedsAction"
            label="Müssen bestehende Lagerbestände nachgearbeitet oder abgebucht werden?"
            value={answers.stockNeedsAction}
            set={(v) => setAnswers((a) => ({ ...a, stockNeedsAction: v }))}
            disabled={locked}
          />
          {answers.stockNeedsAction === "YES" && (
            <TextArea
              name="stockActionExplanation"
              label="Massnahmen für bestehende Lagerbestände"
              value={review?.stockActionExplanation}
              disabled={locked}
              error={error("stockActionExplanation")}
            />
          )}
          <Error text={error("stockNeedsAction")} />
        </Section>
        <Section title="B. Laufende Bestellungen">
          <Question
            name="purchaseOrdersNeedUpdate"
            label="Müssen laufende Bestellungen aktualisiert werden?"
            value={answers.purchaseOrdersNeedUpdate}
            set={(v) =>
              setAnswers((a) => ({ ...a, purchaseOrdersNeedUpdate: v }))
            }
            disabled={locked}
          />
          {answers.purchaseOrdersNeedUpdate === "YES" && (
            <TextArea
              name="purchaseOrderExplanation"
              label="Welche Bestellungen / Anpassungen sind erforderlich?"
              value={review?.purchaseOrderExplanation}
              disabled={locked}
              error={error("purchaseOrderExplanation")}
            />
          )}
          <Error text={error("purchaseOrdersNeedUpdate")} />
        </Section>
        <Section title="C. Laufende / gerüstete Aufträge">
          <Question
            name="productionOrdersNeedUpdate"
            label="Müssen gerüstete oder laufende Aufträge angepasst werden?"
            value={answers.productionOrdersNeedUpdate}
            set={(v) =>
              setAnswers((a) => ({ ...a, productionOrdersNeedUpdate: v }))
            }
            disabled={locked}
          />
          {answers.productionOrdersNeedUpdate === "YES" && (
            <TextArea
              name="productionOrderExplanation"
              label="Welche Aufträge / Massnahmen sind betroffen?"
              value={review?.productionOrderExplanation}
              disabled={locked}
              error={error("productionOrderExplanation")}
            />
          )}
          <Error text={error("productionOrdersNeedUpdate")} />
        </Section>
        <Section title="D. Bereits ausgelieferte Anlagen">
          <Question
            name="deliveredMachinesNeedParts"
            label="Müssen Teile für bereits gelieferte Anlagen bestellt oder nachgeliefert werden?"
            value={answers.deliveredMachinesNeedParts}
            set={(v) =>
              setAnswers((a) => ({ ...a, deliveredMachinesNeedParts: v }))
            }
            disabled={locked}
          />
          {answers.deliveredMachinesNeedParts === "YES" && (
            <TextArea
              name="deliveredMachinesExplanation"
              label="Welche Teile / Anlagen / Massnahmen sind betroffen?"
              value={review?.deliveredMachinesExplanation}
              disabled={locked}
              error={error("deliveredMachinesExplanation")}
            />
          )}
          <Error text={error("deliveredMachinesNeedParts")} />
        </Section>
        <Section title="E. Einführung / Maschinenstand">
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              name="validFromMachineNumber"
              label="Freigabe ab Maschinennummer"
              value={review?.validFromMachineNumber}
              placeholder="z. B. 11850"
              disabled={locked}
            />
            <Input
              name="estimatedAdditionalCosts"
              label="Geschätzte Mehrkosten nach Umsetzung (CHF)"
              value={review?.estimatedAdditionalCosts}
              type="number"
              min="0"
              step="0.01"
              disabled={locked}
              error={error("estimatedAdditionalCosts")}
            />
          </div>
        </Section>
        <Section title="F. Kosten und Bemerkungen">
          <TextArea
            name="remarks"
            label="Bemerkungen AVOR"
            value={review?.remarks}
            disabled={locked}
          />
        </Section>
        {state.message && (
          <p className="text-sm text-red-700">{state.message}</p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-700">{state.success}</p>
        )}
        {editable && !review?.completed && (
          <Card className="flex justify-end gap-3 p-5">
            <button
              disabled={pending}
              name="intent"
              value="save"
              className="rounded-md border px-4 py-2.5 text-sm font-semibold"
            >
              Speichern
            </button>
            <button
              disabled={pending}
              name="intent"
              value="complete"
              className="rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white"
            >
              AVOR-Prüfung abschliessen
            </button>
          </Card>
        )}
      </form>
      {showReopen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-lg bg-white p-6"
          >
            <h2 className="text-lg font-semibold">
              AVOR-Prüfung erneut öffnen
            </h2>
            <form action={reopenAction} className="mt-4">
              <label className="text-sm font-medium">Begründung</label>
              <textarea
                required
                name="reason"
                rows={4}
                className="mt-2 w-full rounded-md border p-3 text-sm"
              />
              {reopenState.message && (
                <p className="mt-2 text-sm text-red-700">
                  {reopenState.message}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopen(false)}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  Abbrechen
                </button>
                <button
                  disabled={reopening}
                  className="rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
                >
                  Erneut öffnen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </Card>
  );
}
function Question({
  name,
  label,
  value,
  set,
  disabled,
}: {
  name: string;
  label: string;
  value: ImpactAnswerKey | null;
  set: (v: ImpactAnswerKey) => void;
  disabled: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(IMPACT_LABELS).map(([key, text]) => (
          <label
            key={key}
            className={`rounded-md border px-3 py-2 text-sm ${value === key ? "border-[#175f91] bg-blue-50 text-[#175f91]" : "border-slate-300"}`}
          >
            <input
              className="sr-only"
              disabled={disabled}
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => set(key as ImpactAnswerKey)}
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function TextArea({
  name,
  label,
  value,
  disabled,
  error,
}: {
  name: string;
  label: string;
  value?: string | null;
  disabled: boolean;
  error?: string;
}) {
  return (
    <AssistedTextField
      name={name}
      label={label}
      defaultValue={value}
      disabled={disabled}
      multiline
      rows={4}
      error={error}
    />
  );
}
function Input({
  name,
  label,
  value,
  disabled,
  error,
  ...props
}: {
  name: string;
  label: string;
  value?: string | null;
  disabled: boolean;
  error?: string;
  type?: string;
  min?: string;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        defaultValue={value ?? ""}
        disabled={disabled}
        className="mt-2 w-full rounded-md border px-3 py-2.5 text-sm disabled:bg-slate-50"
        {...props}
      />
      <Error text={error} />
    </label>
  );
}
function Error({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-700">{text}</p> : null;
}
