import Link from "next/link";
import Form from "next/form";
import { db } from "@/server/db/client";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { buildRequestListQuery } from "@/modules/change-requests/list-query";
import { getCurrentUser } from "@/modules/auth";
import { formatDateZurich } from "@/lib/date-time";
import {
  CHANGE_REQUEST_STATUSES,
  STATUS_LABELS,
  type ChangeRequestStatusKey,
} from "@/modules/workflow/status";
const PAGE_SIZE = 20;
export default async function RequestsPage({
  searchParams,
}: PageProps<"/change-requests">) {
  const params = await searchParams;
  const currentUser = await getCurrentUser();
  const { where, orderBy, page } = buildRequestListQuery(params, currentUser.id);
  const [rows, total, machines, reasons, users] = await Promise.all([
    db.changeRequest.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        machineTypes: { include: { machineType: true }, orderBy: { machineType: { code: "asc" } } },
        applicant: true,
        reasons: { include: { changeReason: true } },
      },
    }),
    db.changeRequest.count({ where }),
    db.machineType.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    }),
    db.changeReason.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <PageHeading
        title="Änderungsanträge"
        description={`${total} Änderungsanträge gefunden.`}
      />
      <nav aria-label="Schnellfilter" className="mb-4 flex flex-wrap gap-2">
        {[["", "Alle"], ["open", "Offen"], ["mine", "Meine"], ["closed", "Abgeschlossen"]].map(([view, label]) => {
          const active = (typeof params.view === "string" ? params.view : "") === view;
          return <Link key={label} href={view ? `/change-requests?view=${view}` : "/change-requests"} className={`rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-[#175f91] bg-[#175f91] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</Link>;
        })}
      </nav>
      <Card className="mb-5 p-4">
        <Form
          action="/change-requests"
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
        >
          <input
            name="q"
            defaultValue={typeof params.q === "string" ? params.q : ""}
            placeholder="Suchen…"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm xl:col-span-2"
          />
          <Select
            name="machineTypeId"
            label="Alle Maschinentypen"
            items={machines.map((x) => [x.id, x.code])}
          />
          <Select
            name="status"
            label="Alle Status"
            items={CHANGE_REQUEST_STATUSES.map((x) => [x, STATUS_LABELS[x]])}
          />
          <Select
            name="applicantId"
            label="Alle Antragsteller"
            items={users.map((x) => [x.id, x.name])}
          />
          <Select
            name="reasonId"
            label="Alle Gründe"
            items={reasons.map((x) => [x.id, x.label])}
          />
          <input
            name="year"
            placeholder="Jahr"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <Select
            name="sort"
            label="Zuletzt aktualisiert"
            items={[
              ["number", "Nummer"],
              ["title", "Titel"],
              ["created", "Erstellt"],
              ["status", "Status"],
            ]}
          />
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            Filtern
          </button>
        </Form>
      </Card>
      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Nummer",
                  "Titel",
                  "Maschinentyp",
                  "Antragsteller",
                  "Status",
                  "Änderungsgrund",
                  "Erstellt",
                  "Aktualisiert",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-[#175f91]"
                      href={`/change-requests/${r.id}`}
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.title || "Unbenannter Entwurf"}
                  </td>
                  <td className="px-4 py-3" title={r.machineTypes.map(({machineType})=>machineType.code).join(", ")}>{machineSummary(r.machineTypes.map(({machineType})=>machineType.code))}</td>
                  <td className="px-4 py-3">{r.applicantName || r.applicant.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status as ChangeRequestStatusKey} />
                  </td>
                  <td className="max-w-60 truncate px-4 py-3">
                    {r.reasons.map((x) => x.changeReason.label).join(", ") ||
                      "–"}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateZurich(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDateZurich(r.updatedAt)}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Keine Änderungsanträge gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">{rows.map((r)=><Link key={r.id} href={`/change-requests/${r.id}`} className="block p-4 hover:bg-slate-50"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-mono text-sm font-semibold text-[#175f91]">{r.number}</p><StatusBadge status={r.status as ChangeRequestStatusKey}/></div><p className="mt-2 font-semibold text-slate-900">{r.title||"Unbenannter Entwurf"}</p><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div><dt className="text-xs text-slate-500">Maschinentypen</dt><dd className="flex flex-wrap gap-1">{r.machineTypes.length?r.machineTypes.map(({machineType})=><span key={machineType.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{machineType.code}</span>):"–"}</dd></div><div><dt className="text-xs text-slate-500">Antragsteller</dt><dd>{r.applicantName||r.applicant.name}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Änderungsgrund</dt><dd>{r.reasons.map((x)=>x.changeReason.label).join(", ")||"–"}</dd></div></dl></Link>)}{!rows.length&&<p className="p-8 text-center text-sm text-slate-500">Keine Änderungsanträge gefunden.</p>}</div>
      </Card>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          aria-disabled={page <= 1}
          href={`?page=${page - 1}`}
          className={`rounded border px-3 py-2 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        >
          Zurück
        </Link>
        <span className="px-3 py-2 text-sm">
          Seite {page} von {pages}
        </span>
        <Link
          aria-disabled={page >= pages}
          href={`?page=${page + 1}`}
          className={`rounded border px-3 py-2 text-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
        >
          Weiter
        </Link>
      </div>
    </>
  );
}
function machineSummary(codes: string[]) { return codes.length <= 2 ? codes.join(", ") || "–" : `${codes[0]} +${codes.length - 1}`; }
function Select({
  name,
  label,
  items,
}: {
  name: string;
  label: string;
  items: (string[] | readonly string[])[];
}) {
  return (
    <select
      name={name}
      className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
    >
      <option value="">{label}</option>
      {items.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
