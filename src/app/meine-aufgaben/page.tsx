import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/modules/auth";
import { filterInbox, type InboxFilter, type InboxItem } from "@/modules/inbox/domain";
import { loadPersonalInbox } from "@/modules/inbox/query";
import { PRIORITY_LABELS } from "@/modules/tasks/domain";

const filters: Array<{ key: InboxFilter; label: string }> = [
  { key: "ALL", label: "Alle" }, { key: "APPROVALS", label: "Freigaben" },
  { key: "REVIEWS", label: "Prüfungen" }, { key: "PURCHASING", label: "Einkauf" },
  { key: "FINAL", label: "Abschluss" }, { key: "TASKS", label: "Aufgaben" },
  { key: "OVERDUE", label: "Überfällig" },
];
const date=(value:Date)=>new Intl.DateTimeFormat("de-CH",{dateStyle:"medium"}).format(value);

export default async function PersonalInboxPage({searchParams}:PageProps<"/meine-aufgaben">){
  const query=await searchParams,user=await getCurrentUser();
  const selected=filters.some((filter)=>filter.key===query.filter)?query.filter as InboxFilter:"ALL";
  const allItems=await loadPersonalInbox(user),items=filterInbox(allItems,selected);
  return <><PageHeading title={`Meine Aufgaben (${allItems.length})`} description="Alles, was aktuell von Ihnen eine Aktion verlangt."/><nav aria-label="Aufgabenfilter" className="mb-6 flex gap-2 overflow-x-auto pb-1">{filters.map((filter)=><Link key={filter.key} href={filter.key==="ALL"?"/meine-aufgaben":`/meine-aufgaben?filter=${filter.key}`} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium ${selected===filter.key?"border-[#175f91] bg-[#175f91] text-white":"border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{filter.label}</Link>)}</nav>{items.length?<div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="hidden grid-cols-[100px_150px_minmax(240px,1fr)_120px_170px_110px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid"><span>Typ</span><span>Änderungsantrag</span><span>Aktion</span><span>Maschinentyp</span><span>Fällig / Priorität</span><span>Status</span></div><div className="divide-y divide-slate-100">{items.map((item)=><InboxRow key={item.id} item={item}/>)}</div></div>:<Card className="p-10 text-center"><p className="font-semibold text-slate-800">Alles erledigt</p><p className="mt-1 text-sm text-slate-500">Für diesen Filter sind aktuell keine offenen Aktionen vorhanden.</p></Card>}</>;
}

function InboxRow({item}:{item:InboxItem}){return <Link href={item.href} className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#175f91] lg:grid-cols-[100px_150px_minmax(240px,1fr)_120px_170px_110px] lg:items-center lg:gap-4"><div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.typeLabel}</span></div><div><p className="font-mono text-sm font-semibold text-[#175f91]">{item.requestNumber}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.requestTitle}</p></div><p className="text-sm font-semibold text-slate-900">{item.action}</p><p className="text-sm text-slate-600">{item.machineType??"–"}</p><div className="text-sm text-slate-600">{item.dueDate?<p className={item.overdue?"font-semibold text-red-700":""}>{date(item.dueDate)}{item.priority?` / ${PRIORITY_LABELS[item.priority]}`:""}</p>:"–"}</div><div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.overdue?"bg-red-100 text-red-700":"bg-blue-50 text-[#175f91]"}`}>{item.overdue?"Überfällig":item.statusLabel}</span></div></Link>}
