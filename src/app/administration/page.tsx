import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth";
import { hasPermission } from "@/modules/authorization/permissions";
export default async function AdministrationPage() { const user = await getCurrentUser(); const allowed = hasPermission(user, "ADMIN_MANAGE"); return <><PageHeading title="Administration" description="Benutzer, Rollen, Maschinentypen und Einstellungen verwalten." /><Card className="p-10 text-center text-sm text-slate-500">{allowed ? "Die Administrationsfunktionen werden in einer späteren Phase ergänzt." : "Sie besitzen keine Berechtigung für die Administration."}</Card></>; }
