"use client";
import { useActionState, useState } from "react";
import { AssistedTextField } from "@/components/assisted-text-field";
import { Card } from "@/components/ui/card";
import {
  reopenPurchasingReview,
  savePurchasingReview,
  type PurchasingActionState,
} from "@/modules/purchasing-review/actions";
type Review = {
  purchasingRequired: boolean | null;
  supplier: string | null;
  supplierNotes: string | null;
  orderRequired: boolean | null;
  orderCompleted: boolean;
  orderNumber: string | null;
  orderDate: string | null;
  orderedBy?: { name: string } | null;
  expectedDeliveryDate: string | null;
  notes: string | null;
  completed: boolean;
  completedBy?: { name: string } | null;
  completedAt?: string | null;
};
export function PurchasingReviewForm({
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
    savePurchasingReview.bind(null, requestId),
    {} as PurchasingActionState,
  );
  const [reopenState, reopenAction, reopening] = useActionState(
    reopenPurchasingReview.bind(null, requestId),
    {} as PurchasingActionState,
  );
  const [purchase, setPurchase] = useState<boolean | null>(
    review?.purchasingRequired ?? null,
  );
  const [order, setOrder] = useState<boolean | null>(
    review?.orderRequired ?? null,
  );
  const [placed, setPlaced] = useState(review?.orderCompleted ?? false);
  const [showReopen, setShowReopen] = useState(false);
  const locked = !editable || Boolean(review?.completed);
  const error = (n: string) => state.errors?.[n]?.[0];
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Status Einkaufsprüfung
          </p>
          <p className="mt-1 font-semibold">
            {!review
              ? "Nicht begonnen"
              : review.completed
                ? "Abgeschlossen"
                : "In Bearbeitung"}
          </p>
          {review?.completed && (
            <p className="mt-1 text-sm text-slate-500">
              Abgeschlossen von {review.completedBy?.name ?? "–"}
              {review.completedAt ? ` · ${review.completedAt}` : ""}
            </p>
          )}
        </div>
        {review?.completed && editable && (
          <button
            type="button"
            onClick={() => setShowReopen(true)}
            className="rounded-md border px-3 py-2 text-sm font-semibold"
          >
            Einkaufsprüfung erneut öffnen
          </button>
        )}
      </Card>
      {!available && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Die Einkaufsprüfung wird nach Abschluss der Technik- und AVOR-Prüfung
          verfügbar.
        </div>
      )}
      <form action={action} className="space-y-5">
        <Card className="space-y-5 p-6">
          <BoolQuestion
            name="purchasingRequired"
            label="Ist eine Beschaffung erforderlich?"
            value={purchase}
            set={setPurchase}
            disabled={locked}
          />
          <Error text={error("purchasingRequired")} />
          {purchase && (
            <>
              <Input
                name="supplier"
                label="Lieferant"
                value={review?.supplier}
                disabled={locked}
                error={error("supplier")}
                placeholder="z. B. Festo AG"
              />
              <AssistedTextField
                name="supplierNotes"
                label="Hinweise zum Lieferanten"
                defaultValue={review?.supplierNotes}
                disabled={locked}
                multiline
                rows={3}
              />
              <BoolQuestion
                name="orderRequired"
                label="Ist eine Bestellung erforderlich?"
                value={order}
                set={setOrder}
                disabled={locked}
              />
              <Error text={error("orderRequired")} />
              {order && (
                <div className="space-y-5">
                  <BoolQuestion
                    name="orderCompleted"
                    label="Bestellung ausgelöst?"
                    value={placed}
                    set={setPlaced}
                    disabled={locked}
                  />
                  <Error text={error("orderCompleted")} />
                  <div className="grid gap-5 md:grid-cols-3">
                    <Input
                      name="orderNumber"
                      label="Bestellnummer (optional)"
                      value={review?.orderNumber}
                      disabled={locked}
                      placeholder="z. B. PO-2026-1842"
                    />
                    <Input
                      name="orderDate"
                      label="Bestelldatum"
                      value={review?.orderDate}
                      disabled={locked}
                      type="date"
                    />
                    <Input
                      name="expectedDeliveryDate"
                      label="Erwarteter Liefertermin"
                      value={review?.expectedDeliveryDate}
                      disabled={locked}
                      type="date"
                    />
                  </div>
                  {review?.orderedBy && (
                    <p className="text-sm text-slate-500">
                      Bestellt von {review.orderedBy.name}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
        <Card className="p-6">
          <AssistedTextField
            name="notes"
            label="Bemerkungen Einkauf"
            defaultValue={review?.notes}
            disabled={locked}
            multiline
            rows={5}
          />
        </Card>
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
              Einkaufsprüfung abschliessen
            </button>
          </Card>
        )}
      </form>
      {showReopen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 sm:p-6"
          >
            <h2 className="text-lg font-semibold">
              Einkaufsprüfung erneut öffnen
            </h2>
            <form action={reopenAction} className="mt-4">
              <label className="text-sm font-medium">
                Begründung
                <textarea
                  required
                  name="reason"
                  rows={4}
                  className="mt-2 block w-full rounded-md border p-3 text-sm"
                />
              </label>
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
function BoolQuestion({
  name,
  label,
  value,
  set,
  disabled,
}: {
  name: string;
  label: string;
  value: boolean | null;
  set: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex gap-2">
        {(
          [
            [true, "Ja", "YES"],
            [false, "Nein", "NO"],
          ] as const
        ).map(([v, t, k]) => (
          <label
            key={k}
            className={`rounded-md border px-3 py-2 text-sm ${value === v ? "border-[#175f91] bg-blue-50 text-[#175f91]" : "border-slate-300"}`}
          >
            <input
              className="sr-only"
              disabled={disabled}
              type="radio"
              name={name}
              value={k}
              checked={value === v}
              onChange={() => set(v)}
            />
            {t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Input({
  name,
  label,
  value,
  disabled,
  error,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  value?: string | null;
  disabled: boolean;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border px-3 py-2.5 text-sm disabled:bg-slate-50"
      />
      <Error text={error} />
    </label>
  );
}
function Error({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-700">{text}</p> : null;
}
