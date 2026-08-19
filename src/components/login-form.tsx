"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/modules/auth/actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, {} as LoginState);
  return <form action={action} className="mt-8 space-y-5">
    <div><label htmlFor="email" className="block text-sm font-medium text-slate-700">E-Mail</label><input id="email" name="email" type="email" autoComplete="email" autoFocus className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/25" />{state.errors?.email && <p className="mt-1 text-sm text-red-700">{state.errors.email}</p>}</div>
    <div><label htmlFor="password" className="block text-sm font-medium text-slate-700">Passwort</label><input id="password" name="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/25" />{state.errors?.password && <p className="mt-1 text-sm text-red-700">{state.errors.password}</p>}</div>
    {state.message && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-md bg-[#175f91] px-4 py-2.5 font-semibold text-white hover:bg-[#124d77] focus:outline-none focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2 disabled:opacity-60">{pending ? "Anmeldung…" : "Anmelden"}</button>
  </form>;
}
