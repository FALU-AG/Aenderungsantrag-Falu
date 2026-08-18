"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { AssistedTextField } from "@/components/assisted-text-field";
import {
  reopenTechnicalReview,
  saveTechnicalReview,
  type TechnicalReviewActionState,
} from "@/modules/technical-review/actions";
import {
  REVIEW_LABELS,
  type ReviewAnswerKey,
} from "@/modules/technical-review/domain";

type Review = {
  operatingSafety: ReviewAnswerKey | null;
  operatingSafetyComment: string | null;
  interchangeability: ReviewAnswerKey | null;
  interchangeabilityComment: string | null;
  affectsOthers: ReviewAnswerKey | null;
  affectedItemsExplanation: string | null;
  existingArticlesUsable: ReviewAnswerKey | null;
  existingArticlesAction: string | null;
  nextSteps: string | null;
  implementationNotes: string | null;
  sparePartsCatalogueUpdated: ReviewAnswerKey | null;
  sparePartsCatalogueComment: string | null;
  manufacturingDocsUpdated: ReviewAnswerKey | null;
  manufacturingDocsComment: string | null;
  completed: boolean;
  completedBy?: { name: string } | null;
  completedAt?: string | null;
};
const initialState: TechnicalReviewActionState = {};
export function TechnicalReviewForm({
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
  const save = saveTechnicalReview.bind(null, requestId);
  const reopen = reopenTechnicalReview.bind(null, requestId);
  const [state, action, pending] = useActionState(save, initialState);
  const [reopenState, reopenAction, reopening] = useActionState(
    reopen,
    initialState,
  );
  const [showReopen, setShowReopen] = useState(false);
  const [answers, setAnswers] = useState<
    Record<string, ReviewAnswerKey | null>
  >({
    operatingSafety: review?.operatingSafety ?? null,
    interchangeability: review?.interchangeability ?? null,
    affectsOthers: review?.affectsOthers ?? null,
    existingArticlesUsable: review?.existingArticlesUsable ?? null,
    sparePartsCatalogueUpdated: review?.sparePartsCatalogueUpdated ?? null,
    manufacturingDocsUpdated: review?.manufacturingDocsUpdated ?? null,
  });
  const locked = !editable || Boolean(review?.completed);
  const status = !review
    ? "Nicht begonnen"
    : review.completed
      ? "Abgeschlossen"
      : "In Bearbeitung";
  const error = (name: string) => state.errors?.[name]?.[0];
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Status technische Prüfung
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
          >
            Technische Prüfung erneut öffnen
          </button>
        )}
      </Card>
      {!available && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Die technische Prüfung wird nach der AVOR- und Technikfreigabe
          verfügbar.
        </div>
      )}
      <form action={action} className="space-y-5">
        <Section title="A. Sicherheit und Austauschbarkeit">
          <Question
            name="operatingSafety"
            label="Betriebssicherheit gewährleistet?"
            value={answers.operatingSafety}
            set={(v) => setAnswers((a) => ({ ...a, operatingSafety: v }))}
            disabled={locked}
          />
          {answers.operatingSafety === "NO" && (
            <TextArea
              name="operatingSafetyComment"
              label="Begründung / erforderliche Massnahmen"
              value={review?.operatingSafetyComment}
              disabled={locked}
              error={error("operatingSafetyComment")}
            />
          )}
          <FieldError text={error("operatingSafety")} />
          <Question
            name="interchangeability"
            label="Austauschbarkeit gewährleistet?"
            value={answers.interchangeability}
            set={(v) => setAnswers((a) => ({ ...a, interchangeability: v }))}
            disabled={locked}
          />
          {answers.interchangeability === "NO" && (
            <TextArea
              name="interchangeabilityComment"
              label="Auswirkungen auf Austauschbarkeit"
              value={review?.interchangeabilityComment}
              disabled={locked}
              error={error("interchangeabilityComment")}
            />
          )}
          <FieldError text={error("interchangeability")} />
        </Section>
        <Section title="B. Auswirkungen">
          <Question
            name="affectsOthers"
            label="Hat die Änderung Auswirkungen auf weitere Artikel, Maschinen oder Baugruppen?"
            value={answers.affectsOthers}
            set={(v) => setAnswers((a) => ({ ...a, affectsOthers: v }))}
            disabled={locked}
          />
          {answers.affectsOthers === "YES" && (
            <TextArea
              name="affectedItemsExplanation"
              label="Welche Artikel, Maschinen oder Baugruppen sind betroffen?"
              value={review?.affectedItemsExplanation}
              disabled={locked}
              error={error("affectedItemsExplanation")}
            />
          )}
          <FieldError text={error("affectsOthers")} />
          <Question
            name="existingArticlesUsable"
            label="Können bestehende Artikel noch verwendet werden?"
            value={answers.existingArticlesUsable}
            set={(v) =>
              setAnswers((a) => ({ ...a, existingArticlesUsable: v }))
            }
            disabled={locked}
          />
          {answers.existingArticlesUsable === "NO" && (
            <TextArea
              name="existingArticlesAction"
              label="Was geschieht mit bestehenden Artikeln?"
              value={review?.existingArticlesAction}
              disabled={locked}
              error={error("existingArticlesAction")}
            />
          )}
          <FieldError text={error("existingArticlesUsable")} />
        </Section>
        <Section title="C. Technische Umsetzung">
          <TextArea
            name="nextSteps"
            label="Nächste Schritte"
            value={review?.nextSteps}
            disabled={locked}
            error={error("nextSteps")}
          />
          <TextArea
            name="implementationNotes"
            label="Technische Umsetzung / Bemerkungen"
            value={review?.implementationNotes}
            disabled={locked}
          />
        </Section>
        <Section title="D. Dokumentation">
          <Question
            name="sparePartsCatalogueUpdated"
            label="ET-Katalog angepasst?"
            value={answers.sparePartsCatalogueUpdated}
            set={(v) =>
              setAnswers((a) => ({ ...a, sparePartsCatalogueUpdated: v }))
            }
            disabled={locked}
          />
          {answers.sparePartsCatalogueUpdated === "NO" && (
            <TextArea
              name="sparePartsCatalogueComment"
              label="Offene Massnahme ET-Katalog"
              value={review?.sparePartsCatalogueComment}
              disabled={locked}
            />
          )}
          <FieldError text={error("sparePartsCatalogueUpdated")} />
          <Question
            name="manufacturingDocsUpdated"
            label="Fertigungsunterlagen aktualisiert / abgelegt?"
            value={answers.manufacturingDocsUpdated}
            set={(v) =>
              setAnswers((a) => ({ ...a, manufacturingDocsUpdated: v }))
            }
            disabled={locked}
          />
          {answers.manufacturingDocsUpdated === "NO" && (
            <TextArea
              name="manufacturingDocsComment"
              label="Offene Massnahme Fertigungsunterlagen"
              value={review?.manufacturingDocsComment}
              disabled={locked}
            />
          )}
          <FieldError text={error("manufacturingDocsUpdated")} />
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
              Technische Prüfung abschliessen
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
              Technische Prüfung erneut öffnen
            </h2>
            <form action={reopenAction} className="mt-4">
              <label className="text-sm font-medium">Begründung</label>
              <textarea
                name="reason"
                required
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
  value: ReviewAnswerKey | null;
  set: (v: ReviewAnswerKey) => void;
  disabled: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(REVIEW_LABELS).map(([key, text]) => (
          <label
            key={key}
            className={`rounded-md border px-3 py-2 text-sm ${value === key ? "border-[#175f91] bg-blue-50 text-[#175f91]" : "border-slate-300"}`}
          >
            <input
              disabled={disabled}
              required={false}
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => set(key as ReviewAnswerKey)}
              className="sr-only"
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
function FieldError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-sm text-red-700">{text}</p> : null;
}
