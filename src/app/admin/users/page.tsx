import { redirect } from "next/navigation";
import { DeleteUserAction } from "@/components/delete-user-action";
import { PageHeading } from "@/components/page-heading";
import { RoleSelector } from "@/components/role-selector";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth";
import { createUser, resetPassword, updateUser } from "@/modules/users/actions";
import { hasUserBusinessHistory, roleSummary, USER_BUSINESS_RELATION_SELECT } from "@/modules/users/domain";
import { db } from "@/server/db/client";

const input = "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#175f91] focus:outline-none focus:ring-2 focus:ring-[#175f91]/20";

export default async function UsersPage() {
  const current = await getCurrentUser();
  if (!current.roles.includes("ADMINISTRATOR")) redirect("/");
  const [users, activeAdministratorCount] = await Promise.all([
    db.user.findMany({
      include: { roles: { include: { role: true } }, _count: { select: USER_BUSINESS_RELATION_SELECT } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.user.count({ where: { active: true, roles: { some: { role: { key: "ADMINISTRATOR" } } } } }),
  ]);

  return <>
    <PageHeading title="Benutzerverwaltung" description="Benutzer, Rollen, Status und Zugangsdaten verwalten." />
    <Card className="mb-6 p-6"><details><summary className="cursor-pointer font-semibold text-[#175f91]">Benutzer erstellen</summary><form action={createUser} className="mt-5 grid gap-4 md:grid-cols-2"><input className={input} name="firstName" placeholder="Vorname" required /><input className={input} name="lastName" placeholder="Nachname" required /><input className={input} name="email" type="email" placeholder="E-Mail" required /><input className={input} name="password" type="password" minLength={10} placeholder="Initiales Passwort (mind. 10 Zeichen)" required /><RoleSelector defaultRoles={["EMPLOYEE"]} /><label className="text-sm"><input type="checkbox" name="active" defaultChecked className="mr-2" />Aktiv</label><button className="rounded-md bg-[#175f91] px-4 py-2 text-sm font-semibold text-white">Benutzer erstellen</button></form></details></Card>
    <div className="space-y-4">{users.map((user) => {
      const roles = user.roles.map(({ role }) => role.key);
      const hasHistory = hasUserBusinessHistory(user._count);
      const isSelf = user.id === current.id;
      const isLastActiveAdministrator = user.active && roles.includes("ADMINISTRATOR") && activeAdministratorCount <= 1;
      const canDelete = !hasHistory && !isSelf && !isLastActiveAdministrator;
      return <Card key={user.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{user.name}{!user.active && <span className="ml-2 text-sm text-slate-500">(inaktiv)</span>}</h2><p className="text-sm text-slate-600">{user.email}</p><p className="mt-1 text-xs text-slate-500">{roleSummary(roles)} · Letzte Anmeldung: {user.lastLoginAt?.toLocaleString("de-CH") ?? "Nie"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.active ? "Aktiv" : "Inaktiv"}</span></div>
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[#175f91]">Benutzer bearbeiten</summary><form action={updateUser.bind(null, user.id)} className="mt-4 grid gap-3 md:grid-cols-2"><input className={input} name="firstName" defaultValue={user.firstName} required /><input className={input} name="lastName" defaultValue={user.lastName} required /><input className={input} name="email" type="email" defaultValue={user.email} required /><RoleSelector defaultRoles={roles} /><label className="text-sm"><input type="checkbox" name="active" defaultChecked={user.active} className="mr-2" />Aktiv</label><button className="rounded-md border border-[#175f91] px-3 py-2 text-sm font-semibold text-[#175f91]">Speichern</button></form><form action={resetPassword.bind(null, user.id)} className="mt-4 flex flex-wrap gap-2 border-t pt-4"><input className={input} name="password" type="password" minLength={10} placeholder="Neues temporäres Passwort" required /><button className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Passwort zurücksetzen</button></form>
          {canDelete ? <DeleteUserAction userId={user.id} userName={user.name} /> : <p className="mt-4 border-t pt-4 text-sm text-slate-600">{hasHistory ? "Dieser Benutzer besitzt geschäftliche Aktivitäten und kann nur deaktiviert werden." : isSelf ? "Das aktuell angemeldete Konto kann nicht gelöscht werden." : "Der letzte aktive Administrator kann nicht gelöscht werden."}{user.active && " Deaktivieren Sie ihn bei Bedarf über den Status «Aktiv»."}</p>}
        </details>
      </Card>;
    })}</div>
  </>;
}
