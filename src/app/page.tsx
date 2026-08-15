import { AlertTriangle, ClipboardCheck, Clock3, Cog, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

const kpis = [
  { label: "Offene Änderungsanträge", value: "–", icon: ClipboardCheck },
  { label: "Warten auf AVOR", value: "–", icon: Clock3 },
  { label: "Warten auf Technik", value: "–", icon: Wrench },
  { label: "In Umsetzung", value: "–", icon: Cog },
  { label: "Überfällige Aufgaben", value: "–", icon: AlertTriangle },
];

export default function DashboardPage() {
  return <><PageHeading title="Dashboard" description="Überblick über Änderungsanträge, Freigaben und offene Arbeiten." />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Kennzahlen">
      {kpis.map(({ label, value, icon: Icon }) => <Card key={label} className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold text-slate-950">{value}</p></div><span className="rounded-md bg-slate-100 p-2 text-[#175f91]"><Icon className="size-5" /></span></div></Card>)}
    </section>
    <Card className="mt-7 overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Zuletzt aktualisiert</h2><p className="mt-0.5 text-sm text-slate-500">Beispieldarstellung für die kommende Antragsübersicht</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Nummer</th><th className="px-5 py-3">Titel</th><th className="px-5 py-3">Maschinentyp</th><th className="px-5 py-3">Status</th></tr></thead><tbody><tr className="border-t border-slate-100"><td className="px-5 py-5 text-slate-500" colSpan={4}>Noch keine Änderungsanträge vorhanden.</td></tr></tbody></table></div>
    </Card>
    <div className="mt-6 flex flex-wrap gap-2" aria-label="Verfügbare Status"><StatusBadge status="DRAFT" /><StatusBadge status="UNDER_REVIEW" /><StatusBadge status="CHANGES_REQUESTED" /><StatusBadge status="APPROVED_FOR_IMPLEMENTATION" /></div>
  </>;
}
