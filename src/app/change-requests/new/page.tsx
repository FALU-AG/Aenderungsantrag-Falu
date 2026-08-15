import { PageHeading } from "@/components/page-heading";
import { ChangeRequestForm } from "@/components/change-request-form";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";

export default async function NewRequestPage() {
  const user = await getCurrentUser(); requirePermission(user, "CHANGE_REQUEST_CREATE");
  const [machines, reasons] = await Promise.all([db.machineType.findMany({ where:{active:true}, orderBy:{code:"asc"} }), db.changeReason.findMany({where:{active:true},orderBy:{sortOrder:"asc"}})]);
  return <><PageHeading title="Neuer Änderungsantrag" description="Erfassen Sie die Änderung und speichern Sie sie als Entwurf oder reichen Sie sie direkt ein."/><ChangeRequestForm userName={user.name} machineTypes={machines.map(m=>({id:m.id,label:m.code}))} reasons={reasons.map(r=>({id:r.id,label:r.label,isOther:r.isOther}))}/></>;
}
