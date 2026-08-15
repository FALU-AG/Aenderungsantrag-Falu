import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { ChangeRequestForm } from "@/components/change-request-form";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requireDraftEdit } from "@/modules/change-requests/authorization";

export default async function EditRequestPage({params}: PageProps<"/change-requests/[id]/edit">) {
  const {id}=await params; const user=await getCurrentUser();
  const [request,machines,reasons]=await Promise.all([db.changeRequest.findUnique({where:{id},include:{reasons:true}}),db.machineType.findMany({where:{active:true},orderBy:{code:"asc"}}),db.changeReason.findMany({where:{active:true},orderBy:{sortOrder:"asc"}})]);
  if(!request) notFound(); requireDraftEdit(user,request);
  return <><PageHeading title={`${request.number} bearbeiten`} description="Änderungen werden mit Versionsprüfung gespeichert."/><ChangeRequestForm userName={user.name} machineTypes={machines.map(m=>({id:m.id,label:m.code}))} reasons={reasons.map(r=>({id:r.id,label:r.label,isOther:r.isOther}))} initial={{id:request.id,version:request.version,number:request.number,createdAt:new Intl.DateTimeFormat("de-CH").format(request.createdAt),title:request.title,machineTypeId:request.machineTypeId??"",articleNumber:request.articleNumber??"",articleDescription:request.articleDescription??"",reasonIds:request.reasons.map(r=>r.changeReasonId),otherReasonText:request.otherReasonText??"",description:request.description}}/></>;
}
