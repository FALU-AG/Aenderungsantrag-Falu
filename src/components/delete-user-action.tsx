"use client";

import { useActionState, useState } from "react";
import { deleteUser, type DeleteUserActionState } from "@/modules/users/actions";

export function DeleteUserAction({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteUser.bind(null, userId), {} as DeleteUserActionState);

  return (
    <div className="mt-4 border-t border-red-100 pt-4">
      {state.error && <p className="mb-3 text-sm text-red-700" role="alert">{state.error}</p>}
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">
        Benutzer löschen
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby={`delete-user-${userId}`} aria-describedby={`delete-user-description-${userId}`} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6">
            <h2 id={`delete-user-${userId}`} className="text-lg font-semibold">Benutzer endgültig löschen?</h2>
            <p className="mt-3 text-sm text-slate-600" id={`delete-user-description-${userId}`}>Dieser Benutzer wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <p className="mt-2 text-sm font-medium text-slate-800">{userName}</p>
            <form action={action} className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2">Abbrechen</button>
              <button disabled={pending} className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-60">{pending ? "Wird gelöscht…" : "Endgültig löschen"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
