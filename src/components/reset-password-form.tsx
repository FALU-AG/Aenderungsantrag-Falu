"use client";
import { useActionState } from "react";
import { resetPassword, type ResetPasswordState } from "@/modules/auth/actions";
import { PasswordInput } from "./password-input";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {} as ResetPasswordState);
  return <form action={action} className="mt-6 space-y-5"><input type="hidden" name="token" value={token} /><PasswordInput id="password" name="password" label="Neues Passwort" autoComplete="new-password" /><PasswordInput id="passwordConfirmation" name="passwordConfirmation" label="Passwort wiederholen" autoComplete="new-password" />{state.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}<button disabled={pending} className="w-full rounded-md bg-[#175f91] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Wird gespeichert…" : "Passwort speichern"}</button></form>;
}
