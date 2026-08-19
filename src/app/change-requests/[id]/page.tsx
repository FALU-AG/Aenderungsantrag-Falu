import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Paperclip, Pencil } from "lucide-react";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ApprovalCard } from "@/components/approval-card";
import { TechnicalReviewForm } from "@/components/technical-review-form";
import { AvorReviewForm } from "@/components/avor-review-form";
import { PurchasingReviewForm } from "@/components/purchasing-review-form";
import { TaskManagement } from "@/components/task-management";
import { FinalReviewPanel } from "@/components/final-review-panel";
import { AttachmentPicker } from "@/components/attachment-picker";
import { canEditDraft } from "@/modules/change-requests/authorization";
import {
  removeAttachment,
  submitExistingRequest,
  uploadAttachment,
} from "@/modules/change-requests/actions";
import {
  APPROVAL_LABELS,
  canDecideApproval,
  type ApprovalStatusKey,
  type ApprovalTypeKey,
} from "@/modules/approvals/domain";
import type { ChangeRequestStatusKey } from "@/modules/workflow/status";
import {
  canEditTechnicalReview,
  REVIEW_LABELS,
  technicalReviewAvailable,
  technicalReviewState,
  type ReviewAnswerKey,
} from "@/modules/technical-review/domain";
import {
  avorReviewAvailable,
  avorReviewState,
  canEditAvorReview,
  IMPACT_LABELS,
  type ImpactAnswerKey,
} from "@/modules/avor-review/domain";
import {
  canEditPurchasingReview,
  isDeliveryOverdue,
  purchasingReviewAvailable,
  purchasingReviewState,
} from "@/modules/purchasing-review/domain";
import {
  isTaskOverdue,
  sortTasks,
  taskSummary,
  type TaskStatusKey,
} from "@/modules/tasks/domain";
import {
  canFinalApprove,
  canRequestFinalChanges,
  closurePrerequisites,
} from "@/modules/final-review/domain";

const tabs = [
  "Übersicht",
  "Freigaben",
  "Technische Prüfung",
  "AVOR",
  "Einkauf",
  "Aufgaben",
  "Abschlussprüfung",
  "Anhänge",
  "Kommentare",
  "Historie",
];
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(date);
type ApprovalView = {
  id: string;
  type: ApprovalTypeKey;
  status: ApprovalStatusKey;
  cycle: number;
  comment: string | null;
  decidedAt: Date | null;
  decisionUser: { name: string } | null;
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/change-requests/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const tab = typeof query.tab === "string" ? query.tab : "Übersicht";
  const user = await getCurrentUser();
  const request = await db.changeRequest.findUnique({
    where: { id },
    include: {
      applicant: true,
      machineType: true,
      reasons: { include: { changeReason: true } },
      approvals: {
        include: { decisionUser: true },
        orderBy: [{ cycle: "desc" }, { type: "asc" }],
      },
      finalApprovals: {
        include: { approvedBy: true },
        orderBy: [{ cycle: "desc" }, { type: "asc" }],
      },
      closedBy: true,
      technicalReview: { include: { completedBy: true } },
      avorImpactReview: { include: { completedBy: true } },
      purchasingReview: { include: { completedBy: true, orderedBy: true } },
      tasks: {
        include: { responsibleUser: true },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      },
      auditEvents: { include: { user: true }, orderBy: { timestamp: "desc" } },
    },
  });
  if (!request) notFound();
  const activeUsers = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const editable = canEditDraft(user, request);
  const current = request.approvals.filter(
    (a) => a.cycle === request.approvalCycle,
  );
  const previousCycles = [
    ...new Set(
      request.approvals
        .filter((a) => a.cycle < request.approvalCycle)
        .map((a) => a.cycle),
    ),
  ].sort((a, b) => b - a);
  const rejectionComments = request.approvals
    .filter((a) => a.status === "REJECTED")
    .map((a) => a.comment)
    .filter((c): c is string => Boolean(c));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm font-semibold text-[#175f91]">
              {request.number}
            </p>
            <StatusBadge status={request.status as ChangeRequestStatusKey} />
          </div>
          <h1 className="mt-2 text-2xl font-bold">
            {request.title || "Unbenannter Entwurf"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {request.machineType?.code ?? "Kein Maschinentyp"} ·{" "}
            {request.applicantName || request.applicant.name} · Aktualisiert{" "}
            {formatDate(request.updatedAt)}
          </p>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Link
              href={`/change-requests/${id}/edit`}
              className="flex items-center gap-2 rounded-md border bg-white px-4 py-2.5 text-sm font-semibold"
            >
              <Pencil className="size-4" />
              {request.status === "CHANGES_REQUESTED"
                ? "Änderung überarbeiten"
                : "Bearbeiten"}
            </Link>
            <form action={submitExistingRequest.bind(null, id)}>
              <button className="rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white">
                {request.status === "CHANGES_REQUESTED"
                  ? "Erneut einreichen"
                  : "Einreichen"}
              </button>
            </form>
          </div>
        )}
      </div>
      <div className="mb-5 overflow-x-auto border-b border-slate-200">
        <nav className="flex min-w-max gap-5">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`?tab=${encodeURIComponent(t)}`}
              className={`border-b-2 px-1 pb-3 text-sm font-medium ${tab === t ? "border-[#175f91] text-[#175f91]" : "border-transparent text-slate-500"}`}
            >
              {t}
            </Link>
          ))}
        </nav>
      </div>
      {tab === "Übersicht" ? (
        <>
          <Overview
            request={request}
            current={current}
            rejectionComments={rejectionComments}
          />
          <div className="mt-5 space-y-5">
            <TechnicalSummary review={request.technicalReview} />
            <AvorSummary review={request.avorImpactReview} />
            <PurchasingSummary review={request.purchasingReview} />
            <TaskSummary tasks={request.tasks} />
            {(request.status === "FINAL_REVIEW" ||
              request.status === "CLOSED") && (
              <FinalStatusSummary request={request} />
            )}
          </div>
        </>
      ) : tab === "Freigaben" ? (
        <Approvals
          requestId={id}
          cycle={request.approvalCycle}
          current={current}
          previousCycles={previousCycles}
          all={request.approvals}
          user={user}
        />
      ) : tab === "Technische Prüfung" ? (
        <TechnicalReviewForm
          requestId={id}
          review={
            request.technicalReview
              ? {
                  ...request.technicalReview,
                  completedAt: request.technicalReview.completedAt
                    ? formatDate(request.technicalReview.completedAt)
                    : null,
                }
              : null
          }
          editable={canEditTechnicalReview(user, request.status)}
          available={technicalReviewAvailable(request.status)}
        />
      ) : tab === "AVOR" ? (
        <AvorReviewForm
          requestId={id}
          review={
            request.avorImpactReview
              ? {
                  ...request.avorImpactReview,
                  estimatedAdditionalCosts:
                    request.avorImpactReview.estimatedAdditionalCosts?.toString() ??
                    null,
                  completedAt: request.avorImpactReview.completedAt
                    ? formatDate(request.avorImpactReview.completedAt)
                    : null,
                }
              : null
          }
          editable={canEditAvorReview(user, request.status)}
          available={avorReviewAvailable(request.status)}
        />
      ) : tab === "Einkauf" ? (
        <PurchasingReviewForm
          requestId={id}
          review={
            request.purchasingReview
              ? {
                  ...request.purchasingReview,
                  orderDate:
                    request.purchasingReview.orderDate
                      ?.toISOString()
                      .slice(0, 10) ?? null,
                  expectedDeliveryDate:
                    request.purchasingReview.expectedDeliveryDate
                      ?.toISOString()
                      .slice(0, 10) ?? null,
                  completedAt: request.purchasingReview.completedAt
                    ? formatDate(request.purchasingReview.completedAt)
                    : null,
                }
              : null
          }
          editable={canEditPurchasingReview(user, request.status)}
          available={purchasingReviewAvailable(request.status)}
        />
      ) : tab === "Aufgaben" ? (
        <TaskManagement
          requestId={id}
          users={activeUsers}
          currentUserId={user.id}
          isAdmin={user.roles.includes("ADMINISTRATOR")}
          readOnly={request.status === "CLOSED"}
          tasks={sortTasks(
            request.tasks.map((task) => ({
              ...task,
              status: task.status as TaskStatusKey,
            })),
          ).map((task) => ({
            ...task,
            dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
            overdue: isTaskOverdue(task.dueDate, task.status),
            closed: request.status === "CLOSED",
          }))}
        />
      ) : tab === "Abschlussprüfung" ? (
        <FinalReviewPanel
          requestId={id}
          status={request.status}
          cycle={request.finalReviewCycle}
          finalComment={request.finalComment}
          prerequisites={closurePrerequisites({
            technicalCompleted: Boolean(request.technicalReview?.completed),
            avorCompleted: Boolean(request.avorImpactReview?.completed),
            purchasingCompleted: Boolean(request.purchasingReview?.completed),
            blockingTasks: request.tasks.filter(
              (task) => task.requiredForClosure && task.status !== "DONE",
            ).length,
          })}
          blockingTasks={request.tasks
            .filter((task) => task.requiredForClosure && task.status !== "DONE")
            .map((task) => ({
              ...task,
              dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
            }))}
          approvals={request.finalApprovals.map((approval) => ({
            ...approval,
            type: approval.type as "AVOR" | "TECHNICAL",
            approvedAt: formatDate(approval.approvedAt),
          }))}
          canApproveAvor={canFinalApprove(user, "AVOR")}
          canApproveTechnical={canFinalApprove(user, "TECHNICAL")}
          canRequestChanges={canRequestFinalChanges(user)}
          isAdmin={user.roles.includes("ADMINISTRATOR")}
          closedAt={request.closedAt ? formatDate(request.closedAt) : null}
          closedBy={request.closedBy?.name ?? null}
        />
      ) : tab === "Anhänge" ? (
        <Attachments
          id={id}
          editable={editable}
          attachments={request.attachments}
        />
      ) : tab === "Historie" ? (
        <Card className="divide-y divide-slate-100">
          {request.auditEvents.map((e) => (
            <div key={e.id} className="p-5">
              <p className="text-sm font-medium">{e.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(e.timestamp)} · {e.user?.name ?? "System"} ·{" "}
                {e.action}
              </p>
            </div>
          ))}
          {!request.auditEvents.length && (
            <p className="p-6 text-sm text-slate-500">
              Keine Einträge vorhanden.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">
          Diese Funktion wird in einer späteren Phase implementiert.
        </Card>
      )}
    </div>
  );
}
function ApprovalSummary({
  approval,
  type,
}: {
  approval?: ApprovalView;
  type: ApprovalTypeKey;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">
        {type === "TECHNICAL" ? "Technik" : "AVOR"}
      </p>
      <p className="mt-1 font-semibold">
        {approval ? APPROVAL_LABELS[approval.status] : "Noch nicht angelegt"}
      </p>
    </div>
  );
}
function TechnicalSummary({
  review,
}: {
  review: {
    completed: boolean;
    completedAt: Date | null;
    completedBy: { name: string } | null;
    operatingSafety: ReviewAnswerKey | null;
    interchangeability: ReviewAnswerKey | null;
    affectsOthers: ReviewAnswerKey | null;
    existingArticlesUsable: ReviewAnswerKey | null;
    nextSteps: string | null;
    implementationNotes: string | null;
    sparePartsCatalogueUpdated: ReviewAnswerKey | null;
    manufacturingDocsUpdated: ReviewAnswerKey | null;
  } | null;
}) {
  const state = technicalReviewState(review);
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Technische Prüfung</h2>
      {!review ? (
        <p className="mt-3 text-sm text-slate-500">
          Technische Prüfung noch nicht begonnen.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium">
            {state === "COMPLETED"
              ? "Abgeschlossen"
              : "Technische Prüfung in Bearbeitung."}
          </p>
          {review.completed && (
            <p className="mt-1 text-xs text-slate-500">
              Abgeschlossen von {review.completedBy?.name ?? "–"}
              {review.completedAt ? ` · ${formatDate(review.completedAt)}` : ""}
            </p>
          )}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item
              l="Betriebssicherheit"
              v={
                review.operatingSafety
                  ? REVIEW_LABELS[review.operatingSafety]
                  : "–"
              }
            />
            <Item
              l="Austauschbarkeit"
              v={
                review.interchangeability
                  ? REVIEW_LABELS[review.interchangeability]
                  : "–"
              }
            />
            <Item
              l="Weitere Auswirkungen"
              v={
                review.affectsOthers ? REVIEW_LABELS[review.affectsOthers] : "–"
              }
            />
            <Item
              l="Bestehende Artikel"
              v={
                review.existingArticlesUsable
                  ? REVIEW_LABELS[review.existingArticlesUsable]
                  : "–"
              }
            />
            <Item
              l="ET-Katalog"
              v={
                review.sparePartsCatalogueUpdated
                  ? REVIEW_LABELS[review.sparePartsCatalogueUpdated]
                  : "–"
              }
            />
            <Item
              l="Fertigungsunterlagen"
              v={
                review.manufacturingDocsUpdated
                  ? REVIEW_LABELS[review.manufacturingDocsUpdated]
                  : "–"
              }
            />
          </dl>
          {review.nextSteps && (
            <p className="mt-4 text-sm">
              <span className="font-medium">Nächste Schritte:</span>{" "}
              {review.nextSteps}
            </p>
          )}
          {review.implementationNotes && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Technische Bemerkungen:</span>{" "}
              {review.implementationNotes}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
function AvorSummary({
  review,
}: {
  review: {
    completed: boolean;
    completedAt: Date | null;
    completedBy: { name: string } | null;
    stockNeedsAction: ImpactAnswerKey | null;
    purchaseOrdersNeedUpdate: ImpactAnswerKey | null;
    productionOrdersNeedUpdate: ImpactAnswerKey | null;
    deliveredMachinesNeedParts: ImpactAnswerKey | null;
    validFromMachineNumber: string | null;
    estimatedAdditionalCosts: { toString(): string } | null;
    currency: string;
    remarks: string | null;
  } | null;
}) {
  const state = avorReviewState(review);
  const cost = review?.estimatedAdditionalCosts
    ? new Intl.NumberFormat("de-CH", {
        style: "currency",
        currency: review.currency,
      }).format(Number(review.estimatedAdditionalCosts.toString()))
    : "–";
  return (
    <Card className="p-6">
      <h2 className="font-semibold">AVOR / Umsetzung</h2>
      {!review ? (
        <p className="mt-3 text-sm text-slate-500">
          AVOR-Prüfung noch nicht begonnen.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium">
            {state === "COMPLETED"
              ? "Abgeschlossen"
              : "AVOR-Prüfung in Bearbeitung."}
          </p>
          {review.completed && (
            <p className="mt-1 text-xs text-slate-500">
              Abgeschlossen von {review.completedBy?.name ?? "–"}
              {review.completedAt ? ` · ${formatDate(review.completedAt)}` : ""}
            </p>
          )}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item
              l="Lagerbestand"
              v={
                review.stockNeedsAction
                  ? IMPACT_LABELS[review.stockNeedsAction]
                  : "–"
              }
            />
            <Item
              l="Laufende Bestellungen"
              v={
                review.purchaseOrdersNeedUpdate
                  ? IMPACT_LABELS[review.purchaseOrdersNeedUpdate]
                  : "–"
              }
            />
            <Item
              l="Laufende Aufträge"
              v={
                review.productionOrdersNeedUpdate
                  ? IMPACT_LABELS[review.productionOrdersNeedUpdate]
                  : "–"
              }
            />
            <Item
              l="Ausgelieferte Anlagen"
              v={
                review.deliveredMachinesNeedParts
                  ? IMPACT_LABELS[review.deliveredMachinesNeedParts]
                  : "–"
              }
            />
            <Item
              l="Freigabe ab Maschinennummer"
              v={review.validFromMachineNumber}
            />
            <Item l="Geschätzte Mehrkosten" v={cost} />
          </dl>
          {review.remarks && (
            <p className="mt-4 text-sm">
              <span className="font-medium">Bemerkungen AVOR:</span>{" "}
              {review.remarks}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
function PurchasingSummary({
  review,
}: {
  review: {
    purchasingRequired: boolean | null;
    supplier: string | null;
    orderRequired: boolean | null;
    orderCompleted: boolean;
    orderNumber: string | null;
    expectedDeliveryDate: Date | null;
    completed: boolean;
    completedAt: Date | null;
    completedBy: { name: string } | null;
  } | null;
}) {
  const overdue = isDeliveryOverdue(
    review?.expectedDeliveryDate,
    review?.orderCompleted ?? false,
  );
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Einkauf / Beschaffung</h2>
        {overdue && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
            Liefertermin überfällig
          </span>
        )}
      </div>
      {!review ? (
        <p className="mt-3 text-sm text-slate-500">
          Einkaufsprüfung noch nicht begonnen.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium">
            {purchasingReviewState(review) === "COMPLETED"
              ? "Abgeschlossen"
              : "Einkaufsprüfung in Bearbeitung."}
          </p>
          {review.completed && (
            <p className="mt-1 text-xs text-slate-500">
              Abgeschlossen von {review.completedBy?.name ?? "–"}
              {review.completedAt ? ` · ${formatDate(review.completedAt)}` : ""}
            </p>
          )}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item
              l="Beschaffung erforderlich"
              v={
                review.purchasingRequired === null
                  ? "–"
                  : review.purchasingRequired
                    ? "Ja"
                    : "Nein"
              }
            />
            <Item l="Lieferant" v={review.supplier} />
            <Item
              l="Bestellung erforderlich"
              v={
                review.orderRequired === null
                  ? "–"
                  : review.orderRequired
                    ? "Ja"
                    : "Nein"
              }
            />
            <Item
              l="Bestellung ausgelöst"
              v={review.orderCompleted ? "Ja" : "Nein"}
            />
            <Item l="Bestellnummer" v={review.orderNumber} />
            <Item
              l="Erwartete Lieferung"
              v={
                review.expectedDeliveryDate
                  ? new Intl.DateTimeFormat("de-CH", {
                      timeZone: "Europe/Zurich",
                    }).format(review.expectedDeliveryDate)
                  : "–"
              }
            />
          </dl>
        </>
      )}
    </Card>
  );
}
function TaskSummary({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    requiredForClosure: boolean;
    responsibleUser: { name: string } | null;
  }>;
}) {
  const normalized = tasks.map((task) => ({
    ...task,
    status: task.status as TaskStatusKey,
  }));
  const summary = taskSummary(normalized);
  const next = sortTasks(normalized)
    .filter((task) => task.status !== "DONE")
    .slice(0, 3);
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Aufgaben</h2>
        <Link
          href="?tab=Aufgaben"
          className="text-sm font-semibold text-[#175f91]"
        >
          Alle Aufgaben anzeigen
        </Link>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <Item l="Offen" v={String(summary.open)} />
        <Item l="Überfällig" v={String(summary.overdue)} />
        <Item l="Blockiert" v={String(summary.blocked)} />
        <Item l="Abschlussrelevant offen" v={String(summary.requiredOpen)} />
      </dl>
      {next.map((task) => (
        <p key={task.id} className="mt-3 text-sm">
          <span className="font-medium">{task.title}</span> ·{" "}
          {task.responsibleUser?.name ?? "Nicht zugewiesen"}
        </p>
      ))}
    </Card>
  );
}
function FinalStatusSummary({
  request,
}: {
  request: {
    status: string;
    finalReviewCycle: number;
    finalComment: string | null;
    closedAt: Date | null;
    closedBy: { name: string } | null;
    finalApprovals: Array<{
      id: string;
      cycle: number;
      type: string;
      approvedAt: Date;
      approvedBy: { name: string };
    }>;
  };
}) {
  const current = request.finalApprovals.filter(
    (a) => a.cycle === request.finalReviewCycle,
  );
  return (
    <Card
      className={`p-6 ${request.status === "CLOSED" ? "border-emerald-200 bg-emerald-50" : "border-violet-200"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Zyklus {request.finalReviewCycle}
          </p>
          <h2 className="mt-1 text-lg font-bold">
            {request.status === "CLOSED" ? "Abgeschlossen" : "Abschlussprüfung"}
          </h2>
        </div>
        <Link
          href="?tab=Abschlusspr%C3%BCfung"
          className="text-sm font-semibold text-[#175f91]"
        >
          Abschlussprüfung anzeigen
        </Link>
      </div>
      {request.status === "CLOSED" && (
        <p className="mt-3 text-sm">
          Abgeschlossen {request.closedAt ? formatDate(request.closedAt) : "–"}{" "}
          · ausgelöst durch {request.closedBy?.name ?? "–"}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["AVOR", "TECHNICAL"] as const).map((type) => {
          const approval = current.find((a) => a.type === type);
          return (
            <div key={type} className="rounded-md border bg-white p-3 text-sm">
              <span className="font-medium">
                {type === "AVOR" ? "AVOR" : "Technik"}:
              </span>{" "}
              {approval
                ? `Freigegeben von ${approval.approvedBy.name} am ${formatDate(approval.approvedAt)}`
                : "Offen"}
            </div>
          );
        })}
      </div>
      {request.finalComment && (
        <p className="mt-4 text-sm">
          <span className="font-medium">Abschlussbemerkung:</span>{" "}
          {request.finalComment}
        </p>
      )}
    </Card>
  );
}
function Overview({
  request,
  current,
  rejectionComments,
}: {
  request: {
    status: string;
    articleNumber: string | null;
    articleDescription: string | null;
    description: string;
    reasons: { changeReason: { label: string } }[];
  };
  current: ApprovalView[];
  rejectionComments: string[];
}) {
  const message =
    request.status === "CLOSED"
      ? "Dieser Änderungsantrag ist abgeschlossen."
      : request.status === "FINAL_REVIEW"
        ? "Der Änderungsantrag befindet sich in der Abschlussprüfung."
        : request.status === "CHANGES_REQUESTED"
          ? "Dieser Änderungsantrag muss überarbeitet werden."
          : request.status === "APPROVED_FOR_IMPLEMENTATION"
            ? "Der Änderungsantrag wurde zur Umsetzung freigegeben."
            : request.status === "UNDER_REVIEW"
              ? "Dieser Änderungsantrag wartet auf Freigaben."
              : "Der Änderungsantrag befindet sich im Entwurf.";
  return (
    <div className="space-y-5">
      <Card
        className={`p-5 ${request.status === "CHANGES_REQUESTED" ? "border-red-200 bg-red-50" : request.status === "CLOSED" ? "border-emerald-200 bg-emerald-50" : ""}`}
      >
        <p className="font-semibold">{message}</p>
        {rejectionComments.map((c, i) => (
          <p key={i} className="mt-2 text-sm text-red-800">
            Ablehnungsgrund: {c}
          </p>
        ))}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <ApprovalSummary
          type="AVOR"
          approval={current.find((a) => a.type === "AVOR")}
        />
        <ApprovalSummary
          type="TECHNICAL"
          approval={current.find((a) => a.type === "TECHNICAL")}
        />
      </div>
      <Card className="p-6">
        <h2 className="font-semibold">Antragsdetails</h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <Item l="Artikel-/Baugruppennummer" v={request.articleNumber} />
          <Item
            l="Artikel-/Baugruppenbezeichnung"
            v={request.articleDescription}
          />
          <div className="md:col-span-2">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Änderungsgrund
            </dt>
            <dd className="mt-1 text-sm">
              {request.reasons.map((r) => r.changeReason.label).join(", ") ||
                "–"}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs font-medium uppercase text-slate-500">
              Beschreibung und Begründung
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">
              {request.description || "–"}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
function Approvals({
  requestId,
  cycle,
  current,
  previousCycles,
  all,
  user,
}: {
  requestId: string;
  cycle: number;
  current: ApprovalView[];
  previousCycles: number[];
  all: ApprovalView[];
  user: Parameters<typeof canDecideApproval>[0];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Aktuelle Freigaberunde {cycle}
        </h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {(["AVOR", "TECHNICAL"] as const).map((type) => {
            const a = current.find((x) => x.type === type);
            return a ? (
              <ApprovalCard
                key={type}
                requestId={requestId}
                type={type}
                status={a.status}
                cycle={a.cycle}
                decisionUser={a.decisionUser?.name}
                decidedAt={a.decidedAt ? formatDate(a.decidedAt) : null}
                comment={a.comment}
                canDecide={canDecideApproval(user, type)}
              />
            ) : (
              <Card key={type} className="p-6">
                Freigabe nicht angelegt.
              </Card>
            );
          })}
        </div>
      </div>
      {previousCycles.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Frühere Freigaberunden</h2>
          <div className="mt-4 space-y-4">
            {previousCycles.map((c) => (
              <Card key={c} className="p-5">
                <h3 className="font-semibold">Freigaberunde {c}</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {all
                    .filter((a) => a.cycle === c)
                    .map((a) => (
                      <div key={a.id} className="rounded-md bg-slate-50 p-4">
                        <p className="text-sm font-semibold">
                          {a.type === "AVOR" ? "AVOR" : "Technik"}:{" "}
                          {APPROVAL_LABELS[a.status]}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {a.decisionUser?.name ?? "–"}
                          {a.decidedAt ? ` · ${formatDate(a.decidedAt)}` : ""}
                        </p>
                        {a.comment && (
                          <p className="mt-2 text-sm">{a.comment}</p>
                        )}
                      </div>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Attachments({
  id,
  editable,
  attachments,
}: {
  id: string;
  editable: boolean;
  attachments: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }[];
}) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Anhänge</h2>
      {editable && (
        <form
          action={uploadAttachment.bind(null, id)}
          className="mt-4 rounded-md border p-4"
        >
          <AttachmentPicker fieldName="file" multiple={false} />
          <button className="mt-4 rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white">
            Auswahl hochladen
          </button>
        </form>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            {a.mimeType.startsWith("image/") ? (
              <Image
                src={`/change-requests/${id}/attachments/${a.id}`}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-16 rounded object-cover"
              />
            ) : (
              <Paperclip className="size-8 text-slate-400" />
            )}
            <div className="min-w-0 flex-1">
              <a
                href={`/change-requests/${id}/attachments/${a.id}`}
                className="block truncate text-sm font-medium text-[#175f91]"
              >
                {a.originalName}
              </a>
              <p className="text-xs text-slate-500">
                {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            {editable && (
              <form action={removeAttachment.bind(null, a.id)}>
                <button className="min-h-10 rounded-md px-2 text-sm text-red-700">
                  Entfernen
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
function Item({ l, v }: { l: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{l}</dt>
      <dd className="mt-1 text-sm">{v || "–"}</dd>
    </div>
  );
}
