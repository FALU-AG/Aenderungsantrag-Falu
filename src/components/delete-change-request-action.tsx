"use client";

import { useActionState, useState } from "react";
import { deleteChangeRequest, type DeleteChangeRequestState } from "@/modules/change-requests/actions";

export function DeleteChangeRequestAction({ requestId, requestNumber }: { requestId: string; requestNumber: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteChangeRequest.bind(null, requestId), {} as DeleteChangeRequestState);
  return <div>
    {state.error && <p role="alert" className="mb-2 max-w-md text-sm text-red-700">{state.error}</p>}
    <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">Änderungsantrag löschen</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div role="dialog" aria-modal="true" aria-labelledby="delete-change-request-title" aria-describedby="delete-change-request-description" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6"><h2 id="delete-change-request-title" className="text-lg font-semibold">Änderungsantrag wirklich löschen?</h2><p id="delete-change-request-description" className="mt-3 text-sm text-slate-600">Der Änderungsantrag {requestNumber} und die zugehörigen Daten werden dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.</p><form action={action} className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2">Abbrechen</button><button disabled={pending} className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-60">{pending ? "Wird gelöscht…" : "Endgültig löschen"}</button></form></div></div>}
  </div>;
}
