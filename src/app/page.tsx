import Link from "next/link";
import {
  ClipboardCheck,
  Clock3,
  Cog,
  Wrench,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/server/db/client";
import type { ChangeRequestStatusKey } from "@/modules/workflow/status";
export default async function DashboardPage() {
  const [open, reviewing, finalReview, overdueTasks, purchasing, recent] =
    await Promise.all([
      db.changeRequest.count({ where: { status: { not: "CLOSED" } } }),
      db.changeRequest.findMany({
        where: { status: "UNDER_REVIEW" },
        select: {
          approvalCycle: true,
          approvals: {
            where: { status: "PENDING" },
            select: { type: true, cycle: true },
          },
        },
      }),
      db.changeRequest.count({ where: { status: "FINAL_REVIEW" } }),
      db.task.count({
        where: {
          dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { not: "DONE" },
        },
      }),
      db.changeRequest.count({ where: { status: "PURCHASING_PROCUREMENT" } }),
      db.changeRequest.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
        include: { machineType: true },
      }),
    ]);
  const avor = reviewing.filter((r) =>
    r.approvals.some((a) => a.cycle === r.approvalCycle && a.type === "AVOR"),
  ).length;
  const technical = reviewing.filter((r) =>
    r.approvals.some(
      (a) => a.cycle === r.approvalCycle && a.type === "TECHNICAL",
    ),
  ).length;
  const kpis = [
    { label: "Offene Änderungsanträge", value: open, icon: ClipboardCheck },
    { label: "Warten auf AVOR", value: avor, icon: Clock3 },
    { label: "Warten auf Technik", value: technical, icon: Wrench },
    {
      label: "Überfällige Aufgaben",
      value: overdueTasks,
      icon: AlertTriangle,
    },
    { label: "Abschlussprüfung offen", value: finalReview, icon: Cog },
    { label: "Einkauf offen", value: purchasing, icon: ShoppingCart },
  ];
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="Überblick über Änderungsanträge, Freigaben und offene Arbeiten."
      />
      <section className="grid gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 2xl:gap-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold sm:mt-3 sm:text-3xl">{value}</p>
              </div>
              <span className="h-fit rounded-md bg-slate-100 p-2 text-[#175f91]">
                <Icon className="size-5" />
              </span>
            </div>
          </Card>
        ))}
      </section>
      <Card className="mt-5 overflow-hidden sm:mt-7">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">
            Zuletzt aktualisierte Änderungsanträge
          </h2>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Nummer</th>
                <th className="px-5 py-3">Titel</th>
                <th className="px-5 py-3">Maschinentyp</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/change-requests/${r.id}`}
                      className="font-semibold text-[#175f91]"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    {r.title || "Unbenannter Entwurf"}
                  </td>
                  <td className="px-5 py-4">{r.machineType?.code ?? "–"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status as ChangeRequestStatusKey} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">{recent.map((r)=><Link key={r.id} href={`/change-requests/${r.id}`} className="block px-4 py-4 hover:bg-slate-50"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-mono text-sm font-semibold text-[#175f91]">{r.number}</p><StatusBadge status={r.status as ChangeRequestStatusKey}/></div><p className="mt-2 font-medium text-slate-900">{r.title||"Unbenannter Entwurf"}</p><p className="mt-1 text-sm text-slate-500">Maschinentyp: {r.machineType?.code??"–"}</p></Link>)}</div>
      </Card>
    </>
  );
}
