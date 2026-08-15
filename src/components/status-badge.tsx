import { cn } from "@/lib/utils";
import { STATUS_LABELS, type ChangeRequestStatusKey } from "@/modules/workflow/status";

const styles: Record<ChangeRequestStatusKey, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 ring-blue-200",
  CHANGES_REQUESTED: "bg-red-50 text-red-700 ring-red-200",
  APPROVED_FOR_IMPLEMENTATION: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  IMPLEMENTATION: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  AVOR_PRODUCTION_PREPARATION: "bg-amber-50 text-amber-800 ring-amber-200",
  PURCHASING_PROCUREMENT: "bg-orange-50 text-orange-700 ring-orange-200",
  FINAL_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  CLOSED: "bg-slate-200 text-slate-800 ring-slate-300",
};

export function StatusBadge({ status, className }: { status: ChangeRequestStatusKey; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", styles[status], className)}>{STATUS_LABELS[status]}</span>;
}
