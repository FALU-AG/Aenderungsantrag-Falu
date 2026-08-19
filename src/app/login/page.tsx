import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/modules/auth";
export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-md bg-[#175f91] font-bold text-white">F</span><div><p className="font-bold tracking-wide">FALU AG</p><h1 className="text-xl font-semibold text-slate-900">Änderungsanträge</h1></div></div><LoginForm /></section></main>;
}
