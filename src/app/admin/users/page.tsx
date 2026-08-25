import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { DeleteUserAction } from "@/components/delete-user-action";
import { PageHeading } from "@/components/page-heading";
import { RoleSelector } from "@/components/role-selector";
import { PasswordInput } from "@/components/password-input";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth";
import { createUser, resetPassword, updateUser } from "@/modules/users/actions";
import { assessUserDeletion, normalizeRoles, ROLE_LABELS, USER_BUSINESS_RELATION_SELECT } from "@/modules/users/domain";
import { db } from "@/server/db/client";
import { formatDateTimeZurich } from "@/lib/date-time";

const input = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/20";

export default async function UsersPage() {
  const current = await getCurrentUser();
  if (!current.roles.includes("ADMINISTRATOR")) redirect("/");
  const [users, activeAdministratorCount] = await Promise.all([
    db.user.findMany({ include: { roles: { include: { role: true } }, _count: { select: USER_BUSINESS_RELATION_SELECT } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.user.count({ where: { active: true, roles: { some: { role: { key: "ADMINISTRATOR" } } } } }),
  ]);

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <PageHeading title="Benutzerverwaltung" description="Benutzer, Rollen, Status und Zugangsdaten verwalten." />
      <details className="group relative">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" aria-hidden="true" />Benutzer erstellen</summary>
        <Card className="absolute right-0 z-20 mt-2 w-[min(42rem,calc(100vw-2.5rem))] p-5 shadow-xl"><h2 className="font-semibold">Neuen Benutzer erstellen</h2><form action={createUser} className="mt-4 grid gap-4 md:grid-cols-2"><input aria-label="Vorname" className={input} name="firstName" placeholder="Vorname" required /><input aria-label="Nachname" className={input} name="lastName" placeholder="Nachname" required /><input aria-label="E-Mail" autoComplete="username" className={input} name="email" type="email" placeholder="E-Mail" required /><PasswordInput label="Initiales Passwort" name="password" minLength={10} placeholder="Mindestens 10 Zeichen" autoComplete="new-password" required /><PasswordInput label="Passwort wiederholen" name="passwordConfirmation" minLength={10} autoComplete="new-password" required /><RoleSelector defaultRoles={["EMPLOYEE"]} /><label className="text-sm"><input type="checkbox" name="active" defaultChecked className="mr-2" />Aktiv</label><button className="rounded-md bg-[#175f91] px-4 py-2 text-sm font-semibold text-white">Benutzer erstellen</button></form></Card>
      </details>
    </div>
    <Card className="overflow-visible">
      <div role="table" aria-label="Benutzer" className="divide-y divide-slate-200">
        <div role="row" className="hidden grid-cols-[minmax(14rem,2fr)_1.3fr_0.7fr_1fr_auto] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid"><span>Benutzer</span><span>Rollen</span><span>Status</span><span>Letzte Anmeldung</span><span>Aktionen</span></div>
        {users.map((user) => {
          const roles = normalizeRoles(user.roles.map(({ role }) => role.key));
          const eligibility = assessUserDeletion({ actorId: current.id, targetId: user.id, targetActive: user.active, targetRoles: roles, activeAdministratorCount, counts: user._count });
          return <div role="row" key={user.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(14rem,2fr)_1.3fr_0.7fr_1fr_auto] md:items-center">
            <div><p className="font-semibold text-slate-900">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div>
            <div className="flex flex-wrap gap-1.5">{roles.map((role) => <span key={role} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#175f91]">{ROLE_LABELS[role]}</span>)}</div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.active ? "Aktiv" : "Inaktiv"}</span>
            <span className="text-sm text-slate-600">{user.lastLoginAt ? formatDateTimeZurich(user.lastLoginAt) : "Nie"}</span>
            <details className="relative md:justify-self-end"><summary className="cursor-pointer list-none rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-[#175f91]">Bearbeiten</summary><Card className="mt-4 p-5 md:absolute md:right-0 md:z-10 md:w-[38rem] md:shadow-xl"><h2 className="font-semibold">{user.name} bearbeiten</h2><form action={updateUser.bind(null, user.id)} className="mt-4 grid gap-3 md:grid-cols-2"><input aria-label="Vorname" className={input} name="firstName" defaultValue={user.firstName} required /><input aria-label="Nachname" className={input} name="lastName" defaultValue={user.lastName} required /><input aria-label="E-Mail" className={input} name="email" type="email" defaultValue={user.email} required /><RoleSelector defaultRoles={roles} /><label className="text-sm"><input type="checkbox" name="active" defaultChecked={user.active} className="mr-2" />Aktiv</label><button className="rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white">Änderungen speichern</button></form><div className="mt-5 border-t pt-4"><p className="mb-3 text-xs font-semibold uppercase text-slate-500">Administrative Aktionen</p><form action={resetPassword.bind(null, user.id)} className="grid gap-3 sm:grid-cols-2"><PasswordInput label="Neues temporäres Passwort" name="password" minLength={10} autoComplete="new-password" required /><PasswordInput label="Passwort wiederholen" name="passwordConfirmation" minLength={10} autoComplete="new-password" required /><button className="min-h-11 rounded-md border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-700 sm:col-span-2">Passwort zurücksetzen</button></form>{eligibility.deletable ? <DeleteUserAction userId={user.id} userName={user.name} /> : <div className="mt-4 border-t border-slate-200 pt-4"><button type="button" disabled className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">Benutzer kann nicht gelöscht werden</button><p className="mt-2 text-sm text-slate-600">{eligibility.message}</p>{eligibility.businessCounts.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-600">{eligibility.businessCounts.map(({ label, count }) => <li key={label}>{label}: {count}</li>)}</ul>}</div>}</div></Card></details>
          </div>;
        })}
      </div>
    </Card>
  </>;
}
