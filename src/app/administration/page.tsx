import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { hasPermission } from "@/modules/authorization/permissions";
export default async function AdministrationPage() { const user = await getCurrentUser(); const allowed = hasPermission(user, "ADMIN_MANAGE"); return <><PageHeading title="Administration" description="Benutzer, Rollen, Stellvertretungen, Maschinentypen und Einstellungen verwalten." />{allowed ? <div className="flex flex-wrap gap-3"><Link href="/admin/users" className="inline-flex rounded-md bg-[#175f91] px-4 py-2 font-semibold text-white">Benutzerverwaltung</Link><Link href="/admin/delegations" className="inline-flex rounded-md border border-[#175f91] px-4 py-2 font-semibold text-[#175f91]">Stellvertretungen</Link></div> : <p className="text-sm text-slate-500">Sie besitzen keine Berechtigung für die Administration.</p>}</>; }
