import { ResetPasswordForm } from "@/components/reset-password-form";
import Link from "next/link";
import { isPasswordResetTokenUsable } from "@/modules/auth/password-reset";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const usable = await isPasswordResetTokenUsable(token);
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm"><h1 className="text-xl font-semibold">Neues Passwort setzen</h1>{usable ? <><p className="mt-2 text-sm text-slate-600">Der Link ist einmalig verwendbar und 30 Minuten gültig.</p><ResetPasswordForm token={token} /></> : <div className="mt-6"><p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.</p><Link href="/forgot-password" className="mt-5 inline-flex rounded-md bg-[#175f91] px-4 py-2.5 font-semibold text-white hover:bg-[#124d77] focus:outline-none focus:ring-2 focus:ring-[#175f91] focus:ring-offset-2">Neuen Link anfordern</Link></div>}</section></main>;
}
