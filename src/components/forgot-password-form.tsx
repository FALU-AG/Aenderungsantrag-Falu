"use client";
import { useActionState } from "react";
import { forgotPassword, type ForgotPasswordState } from "@/modules/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, {} as ForgotPasswordState);
  if (state.sent) return <p role="status" className="mt-6 rounded-md bg-blue-50 p-4 text-sm text-slate-800">Falls ein aktives Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts versendet.</p>;
  return <form action={action} className="mt-6 space-y-5"><div><label htmlFor="email" className="block text-sm font-medium">E-Mail</label><input id="email" name="email" type="email" autoComplete="email" required autoFocus className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/25" /></div><button disabled={pending} className="w-full rounded-md bg-[#175f91] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Wird gesendet…" : "Link anfordern"}</button></form>;
}
