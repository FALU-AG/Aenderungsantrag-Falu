import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock3,
  MinusCircle,
  XCircle,
} from "lucide-react";
import {
  ADDITIONAL_TABS,
  WORKFLOW_STAGE_LABELS,
  type WorkflowStage,
  type WorkflowStageState,
} from "@/modules/workflow/navigation";

const presentation: Record<
  WorkflowStageState,
  { icon: typeof Circle; className: string }
> = {
  COMPLETED: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  CURRENT: {
    icon: Clock3,
    className: "border-blue-300 bg-blue-50 text-[#175f91]",
  },
  NOT_STARTED: {
    icon: Circle,
    className: "border-slate-200 bg-white text-slate-500",
  },
  REJECTED: {
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-800",
  },
  NOT_REQUIRED: {
    icon: MinusCircle,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export function RequestWorkflowNavigation({
  activeTab,
  stages,
}: {
  activeTab: string;
  stages: WorkflowStage[];
}) {
  return (
    <div className="mb-6 space-y-4">
      <section aria-labelledby="workflow-navigation-heading">
        <h2
          id="workflow-navigation-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Workflow
        </h2>
        <nav
          aria-label="Workflow des Änderungsantrags"
          className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"
        >
          {stages.map(({ tab, state }, index) => {
            const { icon: Icon, className } = presentation[state];
            const active = activeTab === tab;
            return (
              <Link
                key={tab}
                href={`?tab=${encodeURIComponent(tab)}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91] focus-visible:ring-offset-2 md:flex-col md:items-start md:gap-2 ${className} ${active ? "ring-2 ring-[#175f91] ring-offset-1" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-current">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-semibold md:whitespace-normal">
                    {tab}
                  </span>
                </span>
                <span className="ml-auto text-xs font-medium md:ml-0">
                  {WORKFLOW_STAGE_LABELS[state]}
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
      <section aria-labelledby="additional-navigation-heading">
        <h2
          id="additional-navigation-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Weitere Bereiche
        </h2>
        <nav
          aria-label="Weitere Bereiche des Änderungsantrags"
          className="flex flex-wrap gap-2"
        >
          {ADDITIONAL_TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <Link
                key={tab}
                href={`?tab=${encodeURIComponent(tab)}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175f91] ${active ? "border-[#175f91] bg-[#175f91] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {tab}
              </Link>
            );
          })}
        </nav>
      </section>
    </div>
  );
}
