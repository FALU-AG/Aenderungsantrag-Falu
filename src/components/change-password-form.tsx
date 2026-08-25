"use client";
import { useActionState } from "react";
import { changeOwnPassword, type ChangePasswordState } from "@/modules/auth/actions";
import { PasswordInput } from "@/components/password-input";
export function ChangePasswordForm(){const[state,action,pending]=useActionState(changeOwnPassword,{} as ChangePasswordState);return <form action={action} className="mt-5 space-y-4"><PasswordInput name="password" label="Neues Passwort" minLength={10} required autoFocus autoComplete="new-password" placeholder="Mindestens 10 Zeichen" error={state.errors?.password}/><PasswordInput name="passwordConfirmation" label="Passwort wiederholen" minLength={10} required autoComplete="new-password" error={state.errors?.passwordConfirmation}/><button disabled={pending} className="min-h-11 w-full rounded-md bg-[#175f91] px-4 py-2 text-white">Passwort ändern</button></form>}
