import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { ChangeRequestForm } from "@/components/change-request-form";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requireDraftEdit } from "@/modules/change-requests/authorization";

export default async function EditRequestPage({
  params,
}: PageProps<"/change-requests/[id]/edit">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [request, machines, reasons] = await Promise.all([
    db.changeRequest.findUnique({ where: { id }, include: { reasons: true, machineTypes: true } }),
    db.machineType.findMany({
      where: { OR: [{ active: true }, { requests: { some: { changeRequestId: id } } }] },
      orderBy: { code: "asc" },
    }),
    db.changeReason.findMany({
      where: {
        OR: [{ active: true }, { requests: { some: { changeRequestId: id } } }],
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  if (!request) notFound();
  requireDraftEdit(user, request);
  return (
    <>
      {request.status === "CHANGES_REQUESTED" && (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">
            Dieser Änderungsantrag wurde zur Überarbeitung zurückgegeben.
          </p>
          <p className="mt-1">
            Prüfen Sie die Ablehnungsgründe im Tab «Freigaben» und reichen Sie
            den Antrag anschließend erneut ein.
          </p>
        </div>
      )}
      <PageHeading
        title={`${request.number} bearbeiten`}
        description="Änderungen werden mit Versionsprüfung gespeichert."
      />
      <ChangeRequestForm
        machineTypes={machines.map((m) => ({ id: m.id, label: m.code, active: m.active }))}
        reasons={reasons.map((r) => ({
          id: r.id,
          label: r.label,
          isOther: r.isOther,
          active: r.active,
        }))}
        initial={{
          id: request.id,
          version: request.version,
          number: request.number,
          createdAt: new Intl.DateTimeFormat("de-CH").format(request.createdAt),
          applicantName: request.applicantName,
          title: request.title,
          machineTypeIds: request.machineTypes.map(({ machineTypeId }) => machineTypeId),
          articleNumber: request.articleNumber ?? "",
          articleDescription: request.articleDescription ?? "",
          reasonIds: request.reasons.map((r) => r.changeReasonId),
          otherReasonText: request.otherReasonText ?? "",
          description: request.description,
        }}
      />
    </>
  );
}
