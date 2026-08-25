"use client";

import { useActionState, useState } from "react";
import { decideApproval, type ApprovalActionState } from "@/modules/approvals/actions";
import { APPROVAL_LABELS, approvalActionAvailable, type ApprovalStatusKey, type ApprovalTypeKey } from "@/modules/approvals/domain";
import { Card } from "@/components/ui/card";

const badge: Record<ApprovalStatusKey, string> = { PENDING: "bg-amber-50 text-amber-800", APPROVED: "bg-emerald-50 text-emerald-700", REJECTED: "bg-red-50 text-red-700" };
type Props = { requestId: string; type: ApprovalTypeKey; status: ApprovalStatusKey; cycle: number; currentCycle: number; requestStatus: string; decisionUser?: string | null; decidedAt?: string | null; comment?: string | null; canDecide: boolean };

export function ApprovalCard({ requestId, type, status, cycle, currentCycle, requestStatus, decisionUser, decidedAt, comment, canDecide }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const bound = decideApproval.bind(null, requestId, type);
  const [state, action, pending] = useActionState(bound, {} as ApprovalActionState);
  const title = type === "AVOR" ? "AVOR" : "Technik";
  const actionable = approvalActionAvailable({ canDecide, approvalStatus: status, requestStatus, approvalCycle: cycle, currentCycle });
  const stopped = status === "PENDING" && requestStatus === "CHANGES_REQUESTED" && cycle === currentCycle;
  return <Card className="p-4 sm:p-6">
    <div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-xs text-slate-500">Freigaberunde {cycle}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge[status]}`}>{APPROVAL_LABELS[status]}</span></div>
    {type === "TECHNICAL" && status === "APPROVED" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ Technische Bearbeitung kann beginnen</p>}
    {decisionUser && <p className="mt-5 text-sm"><span className="text-slate-500">Entscheidung:</span> {decisionUser}{decidedAt ? ` · ${decidedAt}` : ""}</p>}
    {comment && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">{comment}</p>}
    {stopped && <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Freigaberunde beendet</p><p className="mt-1">Der Antrag wurde bereits abgelehnt und muss zuerst überarbeitet und erneut eingereicht werden.</p></div>}
    {state.error && <p className="mt-3 text-sm text-red-700">{state.error}</p>}
    {state.success && <p className="mt-3 text-sm text-emerald-700">Entscheidung gespeichert.</p>}
    {actionable && <div className="mt-5 flex flex-wrap gap-2"><form action={action}><input type="hidden" name="decision" value="APPROVED" /><button disabled={pending} className="min-h-11 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white" onClick={(event) => { if (!confirm(`${title}-Freigabe wirklich erteilen?`)) event.preventDefault(); }}>Freigeben</button></form><button className="min-h-11 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => setRejecting(true)}>Ablehnen</button></div>}
    {rejecting && actionable && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" aria-labelledby={`reject-${type}`} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"><h2 id={`reject-${type}`} className="text-lg font-semibold">Ablehnung begründen</h2><form action={action} className="mt-4"><input type="hidden" name="decision" value="REJECTED" /><textarea required name="comment" rows={5} className="w-full rounded-md border border-slate-300 p-3 text-sm" /><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setRejecting(false)} className="min-h-11 rounded-md border px-3 py-2 text-sm">Abbrechen</button><button disabled={pending} className="min-h-11 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white">Ablehnen</button></div></form></div></div>}
  </Card>;
}
