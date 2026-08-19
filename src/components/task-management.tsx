"use client";
import { useActionState } from "react";
import Link from "next/link";
import { AssistedTextField } from "@/components/assisted-text-field";
import { Card } from "@/components/ui/card";
import {
  createTask,
  deleteOpenTask,
  quickTaskStatus,
  updateTask,
  type TaskActionState,
} from "@/modules/tasks/actions";
import {
  DEPARTMENT_LABELS,
  PRIORITY_LABELS,
  TASK_DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatusKey,
} from "@/modules/tasks/domain";
type User = { id: string; name: string };
export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  responsibleUserId: string | null;
  responsibleUser: { name: string } | null;
  department: keyof typeof DEPARTMENT_LABELS;
  dueDate: string | null;
  priority: keyof typeof PRIORITY_LABELS;
  status: TaskStatusKey;
  requiredForClosure: boolean;
  createdById: string;
  overdue: boolean;
  closed?: boolean;
  changeRequest?: {
    id: string;
    number: string;
    title: string;
    machineType: { code: string } | null;
  };
};
export function TaskManagement({
  requestId,
  tasks,
  users,
  currentUserId,
  isAdmin,
  readOnly = false,
}: {
  requestId: string;
  tasks: TaskView[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-5">
      {!readOnly && (
        <details>
          <summary className="ml-auto w-fit cursor-pointer list-none rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white">
            Aufgabe erstellen
          </summary>
          <div className="mt-5">
            <CreateTaskForm requestId={requestId} users={users} />
          </div>
        </details>
      )}
      <TaskList
        tasks={tasks}
        users={users}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        readOnly={readOnly}
      />
    </div>
  );
}
export function TaskList({
  tasks,
  users,
  currentUserId,
  isAdmin,
  readOnly = false,
}: {
  tasks: TaskView[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly?: boolean;
}) {
  const active = tasks.filter((t) => t.status !== "DONE"),
    done = tasks.filter((t) => t.status === "DONE");
  return (
    <>
      {!tasks.length && (
        <Card className="p-10 text-center text-sm text-slate-500">
          Keine Aufgaben vorhanden.
        </Card>
      )}{" "}
      {!!active.length && (
        <section>
          <h2 className="mb-3 font-semibold">
            Offene Aufgaben ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                users={users}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
      )}
      {!!done.length && (
        <section className="pt-3">
          <h2 className="mb-3 font-semibold text-slate-600">
            Erledigte Aufgaben ({done.length})
          </h2>
          <div className="space-y-3">
            {done.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                users={users}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
function CreateTaskForm({
  requestId,
  users,
}: {
  requestId: string;
  users: User[];
}) {
  const [state, action, pending] = useActionState(
    createTask.bind(null, requestId),
    {} as TaskActionState,
  );
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Neue Aufgabe</h2>
      <form action={action} className="mt-5 space-y-5">
        <AssistedTextField
          name="title"
          label="Titel"
          required
          error={state.errors?.title?.[0]}
        />
        <AssistedTextField
          name="description"
          label="Beschreibung"
          multiline
          rows={4}
        />
        <Fields users={users} />
        {state.message && (
          <p className="text-sm text-red-700">{state.message}</p>
        )}
        {state.success && (
          <p className="text-sm text-emerald-700">{state.success}</p>
        )}
        <button
          disabled={pending}
          className="rounded-md bg-[#175f91] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Aufgabe erstellen
        </button>
      </form>
    </Card>
  );
}
function TaskCard({
  task,
  users,
  currentUserId,
  isAdmin,
  readOnly,
}: {
  task: TaskView;
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateTask.bind(null, task.id),
    {} as TaskActionState,
  );
  const locked = readOnly || Boolean(task.closed);
  const full = !locked && (isAdmin || task.createdById === currentUserId),
    responsible = task.responsibleUserId === currentUserId,
    editable = !locked && (full || responsible);
  return (
    <Card
      className={`p-5 ${task.overdue ? "border-red-300 bg-red-50/40" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{task.title}</h3>
          {task.changeRequest && (
            <Link
              href={`/change-requests/${task.changeRequest.id}?tab=Aufgaben`}
              className="mt-1 block text-sm text-[#175f91]"
            >
              {task.changeRequest.number} · {task.changeRequest.title}
            </Link>
          )}
          <p className="mt-2 text-sm text-slate-600">
            {task.responsibleUser?.name ?? "Nicht zugewiesen"} ·{" "}
            {DEPARTMENT_LABELS[task.department]} ·{" "}
            {task.dueDate ?? "Keine Fälligkeit"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {task.overdue && (
            <Badge className="bg-red-100 text-red-700">Überfällig</Badge>
          )}
          <Badge>{PRIORITY_LABELS[task.priority]}</Badge>
          <Badge>{TASK_STATUS_LABELS[task.status]}</Badge>
          {task.requiredForClosure && (
            <Badge className="bg-amber-100 text-amber-800">
              Abschlussrelevant
            </Badge>
          )}
        </div>
      </div>
      {editable && task.status !== "DONE" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {task.status === "OPEN" && (
            <Quick id={task.id} status="IN_PROGRESS" text="In Bearbeitung" />
          )}
          {task.status === "IN_PROGRESS" && (
            <Quick id={task.id} status="DONE" text="Erledigen" />
          )}
          {task.status !== "BLOCKED" && (
            <Quick id={task.id} status="BLOCKED" text="Blockieren" />
          )}
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#175f91]">
          Details {editable ? "bearbeiten" : "anzeigen"}
        </summary>
        <form action={action} className="mt-4 space-y-4">
          {!full && <input type="hidden" name="title" value={task.title} />}
          <AssistedTextField
            name="title"
            label="Titel"
            defaultValue={task.title}
            disabled={!full}
          />
          <AssistedTextField
            name="description"
            label="Beschreibung"
            defaultValue={task.description}
            disabled={!editable}
            multiline
            rows={3}
          />
          <Fields
            users={users}
            task={task}
            full={full}
            responsible={responsible}
          />
          {state.message && (
            <p className="text-sm text-red-700">{state.message}</p>
          )}
          {state.success && (
            <p className="text-sm text-emerald-700">{state.success}</p>
          )}
          {editable && (
            <button
              disabled={pending}
              className="rounded-md bg-[#175f91] px-3 py-2 text-sm font-semibold text-white"
            >
              Speichern
            </button>
          )}
        </form>
        {full && task.status === "OPEN" && (
          <form action={deleteOpenTask.bind(null, task.id)} className="mt-3">
            <button className="text-sm font-medium text-red-700">
              Offene Aufgabe löschen
            </button>
          </form>
        )}
      </details>
    </Card>
  );
}
function Fields({
  users,
  task,
  full = true,
  responsible = false,
}: {
  users: User[];
  task?: TaskView;
  full?: boolean;
  responsible?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Select
        name="responsibleUserId"
        label="Verantwortlich"
        value={task?.responsibleUserId ?? ""}
        disabled={!full}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
      <Select
        name="department"
        label="Abteilung"
        value={task?.department ?? "TECHNICAL"}
        disabled={!full}
      >
        {TASK_DEPARTMENTS.map((k) => (
          <option key={k} value={k}>
            {DEPARTMENT_LABELS[k]}
          </option>
        ))}
      </Select>
      <label className="text-sm font-medium">
        Fällig am
        <input
          type="date"
          name="dueDate"
          defaultValue={task?.dueDate ?? ""}
          disabled={!full && !responsible}
          className="mt-2 block w-full rounded-md border px-3 py-2.5 disabled:bg-slate-50"
        />
      </label>
      <Select
        name="priority"
        label="Priorität"
        value={task?.priority ?? "NORMAL"}
        disabled={!full}
      >
        {TASK_PRIORITIES.map((k) => (
          <option key={k} value={k}>
            {PRIORITY_LABELS[k]}
          </option>
        ))}
      </Select>
      <Select
        name="status"
        label="Status"
        value={task?.status ?? "OPEN"}
        disabled={!full && !responsible}
      >
        {TASK_STATUSES.map((k) => (
          <option key={k} value={k}>
            {TASK_STATUS_LABELS[k]}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 self-end rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          name="requiredForClosure"
          defaultChecked={task?.requiredForClosure ?? true}
          disabled={!full}
        />
        Für Abschluss erforderlich
      </label>
    </div>
  );
}
function Select({
  name,
  label,
  value,
  disabled,
  children,
}: {
  name: string;
  label: string;
  value: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      {disabled && <input type="hidden" name={name} value={value} />}
      <select
        name={name}
        defaultValue={value}
        disabled={disabled}
        required
        className="mt-2 block w-full rounded-md border bg-white px-3 py-2.5 disabled:bg-slate-50"
      >
        <option value="" disabled>
          Bitte auswählen
        </option>
        {children}
      </select>
    </label>
  );
}
function Quick({
  id,
  status,
  text,
}: {
  id: string;
  status: TaskStatusKey;
  text: string;
}) {
  return (
    <form action={quickTaskStatus.bind(null, id, status)}>
      <button className="rounded-md border bg-white px-3 py-2 text-sm font-semibold">
        {text}
      </button>
    </form>
  );
}
function Badge({
  children,
  className = "bg-slate-100 text-slate-700",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
