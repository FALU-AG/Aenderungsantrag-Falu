"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { AssistedTextField } from "@/components/assisted-text-field";
import { Card } from "@/components/ui/card";
import {
  grantFinalApproval,
  reopenClosedRequest,
  requestFinalChanges,
  saveFinalComment,
  type FinalReviewActionState,
} from "@/modules/final-review/actions";
import {
  FINAL_TYPE_LABELS,
  type FinalApprovalType,
} from "@/modules/final-review/domain";
type Approval = {
  id: string;
  type: FinalApprovalType;
  cycle: number;
  approvedAt: string;
  comment: string | null;
  approvedBy: { name: string };
};
type BlockingTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  responsibleUser: { name: string } | null;
};
export function FinalReviewPanel({
  requestId,
  status,
  cycle,
  finalComment,
  prerequisites,
  blockingTasks,
  approvals,
  canApproveAvor,
  canApproveTechnical,
  canRequestChanges,
  isAdmin,
  closedAt,
  closedBy,
}: {
  requestId: string;
  status: string;
  cycle: number;
  finalComment: string | null;
  prerequisites: Array<{ key: string; label: string; satisfied: boolean }>;
  blockingTasks: BlockingTask[];
  approvals: Approval[];
  canApproveAvor: boolean;
  canApproveTechnical: boolean;
  canRequestChanges: boolean;
  isAdmin: boolean;
  closedAt: string | null;
  closedBy: string | null;
}) {
  const current = approvals.filter((a) => a.cycle === cycle);
  const allReady = prerequisites.every((p) => p.satisfied);
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Abschlussprüfung · Zyklus {cycle}
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {status === "CLOSED" ? "Abgeschlossen" : "Voraussetzungen"}
            </h2>
            {status === "CLOSED" && (
              <p className="mt-2 text-sm text-slate-600">
                Abgeschlossen {closedAt ?? "–"} · ausgelöst durch{" "}
                {closedBy ?? "–"}
              </p>
            )}
          </div>
          {status === "CLOSED" && isAdmin && <Reopen requestId={requestId} />}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {prerequisites.map((p) => (
            <div
              key={p.key}
              className={`rounded-md border p-3 text-sm font-medium ${p.satisfied ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
            >
              {p.satisfied ? "✓" : "✕"} {p.label}
            </div>
          ))}
        </div>
        {blockingTasks.length > 0 && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Der Änderungsantrag kann noch nicht abgeschlossen werden.
            </p>
            <p className="mt-1 text-sm text-red-700">
              Es sind noch {blockingTasks.length} abschlussrelevante Aufgaben
              offen.
            </p>
            {blockingTasks.map((t) => (
              <p key={t.id} className="mt-2 text-sm">
                {t.title} · {t.responsibleUser?.name ?? "Nicht zugewiesen"} ·{" "}
                {t.status} · {t.dueDate ?? "Kein Termin"}
              </p>
            ))}
            <Link
              href="?tab=Aufgaben"
              className="mt-3 inline-block text-sm font-semibold text-[#175f91]"
            >
              Aufgaben anzeigen
            </Link>
          </div>
        )}
      </Card>
      <Card className="p-6">
        <h2 className="font-semibold">Abschlussfreigaben</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["AVOR", "TECHNICAL"] as const).map((type) => {
            const approval = current.find((a) => a.type === type);
            const allowed =
              type === "AVOR" ? canApproveAvor : canApproveTechnical;
            return (
              <div key={type} className="rounded-md border p-4">
                <p className="text-sm font-semibold">
                  Abschlussfreigabe {FINAL_TYPE_LABELS[type]}
                </p>
                <p className="mt-2 text-sm">
                  Status:{" "}
                  <span className="font-semibold">
                    {approval ? "Freigegeben" : "Offen"}
                  </span>
                </p>
                {approval ? (
                  <>
                    <p className="mt-1 text-xs text-slate-500">
                      {approval.approvedBy.name} · {approval.approvedAt}
                    </p>
                    {approval.comment && (
                      <p className="mt-3 text-sm">{approval.comment}</p>
                    )}
                  </>
                ) : status === "FINAL_REVIEW" && allowed && allReady ? (
                  <ApprovalAction requestId={requestId} type={type} />
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
      <FinalComment
        requestId={requestId}
        value={finalComment}
        editable={status === "FINAL_REVIEW" && canRequestChanges}
      />
      {status === "FINAL_REVIEW" && canRequestChanges && (
        <ChangesRequired requestId={requestId} />
      )}{" "}
      {approvals.some((a) => a.cycle < cycle) && (
        <Card className="p-6">
          <h2 className="font-semibold">Frühere Abschlusszyklen</h2>
          {approvals
            .filter((a) => a.cycle < cycle)
            .map((a) => (
              <p key={a.id} className="mt-3 text-sm">
                Zyklus {a.cycle} · {FINAL_TYPE_LABELS[a.type]} freigegeben von{" "}
                {a.approvedBy.name} am {a.approvedAt}
              </p>
            ))}
        </Card>
      )}
    </div>
  );
}
function ApprovalAction({
  requestId,
  type,
}: {
  requestId: string;
  type: FinalApprovalType;
}) {
  const [state, action, pending] = useActionState(
    grantFinalApproval.bind(null, requestId, type),
    {} as FinalReviewActionState,
  );
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
      >
        Abschluss freigeben
      </button>
      {state.message && (
        <p className="mt-2 text-sm text-red-700">{state.message}</p>
      )}
      {state.success && (
        <p className="mt-2 text-sm text-emerald-700">{state.success}</p>
      )}
      {open && (
        <Modal
          title="Abschlussfreigabe bestätigen"
          close={() => setOpen(false)}
        >
          <p className="text-sm text-slate-600">
            Mit dieser Freigabe bestätigen Sie, dass die Arbeiten aus Sicht von{" "}
            {FINAL_TYPE_LABELS[type]} abgeschlossen sind.
          </p>
          <form action={action} className="mt-4">
            <label className="text-sm font-medium">
              Bemerkung (optional)
              <textarea
                name="comment"
                rows={3}
                className="mt-2 block w-full rounded-md border p-3"
              />
            </label>
            <button
              disabled={pending}
              className="mt-4 rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
            >
              Abschlussfreigabe bestätigen
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function FinalComment({
  requestId,
  value,
  editable,
}: {
  requestId: string;
  value: string | null;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveFinalComment.bind(null, requestId),
    {} as FinalReviewActionState,
  );
  return (
    <Card className="p-6">
      <form action={action}>
        <AssistedTextField
          name="finalComment"
          label="Abschlussbemerkung"
          defaultValue={value}
          disabled={!editable}
          multiline
          rows={5}
        />
        {state.message && (
          <p className="mt-2 text-sm text-red-700">{state.message}</p>
        )}
        {state.success && (
          <p className="mt-2 text-sm text-emerald-700">{state.success}</p>
        )}
        {editable && (
          <button
            disabled={pending}
            className="mt-4 rounded-md border px-3 py-2 text-sm font-semibold"
          >
            Abschlussbemerkung speichern
          </button>
        )}
      </form>
    </Card>
  );
}
function ChangesRequired({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(
    requestFinalChanges.bind(null, requestId),
    {} as FinalReviewActionState,
  );
  return (
    <Card className="border-amber-200 p-6">
      <h2 className="font-semibold">Änderungen erforderlich</h2>
      <form action={action} className="mt-3">
        <label className="text-sm">
          Bitte beschreiben Sie, was vor dem Abschluss noch angepasst werden
          muss.
          <textarea
            required
            name="reason"
            rows={4}
            className="mt-2 block w-full rounded-md border p-3"
          />
        </label>
        {state.message && (
          <p className="mt-2 text-sm text-red-700">{state.message}</p>
        )}
        <button
          disabled={pending}
          className="mt-4 rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
        >
          Änderungen erforderlich
        </button>
      </form>
    </Card>
  );
}
function Reopen({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(
    reopenClosedRequest.bind(null, requestId),
    {} as FinalReviewActionState,
  );
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border px-3 py-2 text-sm font-semibold"
      >
        Änderungsantrag erneut öffnen
      </button>
      {open && (
        <Modal
          title="Änderungsantrag erneut öffnen"
          close={() => setOpen(false)}
        >
          <p className="text-sm text-amber-700">
            Der abgeschlossene Änderungsantrag wird erneut zur Bearbeitung
            geöffnet.
          </p>
          <form action={action} className="mt-4">
            <textarea
              required
              name="reason"
              aria-label="Grund für Wiedereröffnung"
              rows={4}
              className="w-full rounded-md border p-3"
            />
            {state.message && (
              <p className="mt-2 text-sm text-red-700">{state.message}</p>
            )}
            <button
              disabled={pending}
              className="mt-4 rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
            >
              Erneut öffnen
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg bg-white p-6"
      >
        <div className="flex justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={close} aria-label="Dialog schliessen">
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
