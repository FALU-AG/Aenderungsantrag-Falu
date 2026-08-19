import { PageHeading } from "@/components/page-heading";
import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { hasPermission } from "@/modules/authorization/permissions";
export default async function AdministrationPage() { const user = await getCurrentUser(); const allowed = hasPermission(user, "ADMIN_MANAGE"); return <><PageHeading title="Administration" description="Benutzer, Rollen, Maschinentypen und Einstellungen verwalten." />{allowed ? <Link href="/admin/users" className="inline-flex rounded-md bg-[#175f91] px-4 py-2 font-semibold text-white">Benutzerverwaltung</Link> : <p className="text-sm text-slate-500">Sie besitzen keine Berechtigung für die Administration.</p>}</>; }
