import { PageHeading } from "@/components/page-heading";
import { TaskList } from "@/components/task-management";
import { getCurrentUser } from "@/modules/auth";
import {
  DEPARTMENT_LABELS,
  isTaskOverdue,
  PRIORITY_LABELS,
  sortTasks,
  TASK_DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatusKey,
} from "@/modules/tasks/domain";
import { db } from "@/server/db/client";
export default async function TasksPage({
  searchParams,
}: PageProps<"/meine-aufgaben">) {
  const query = await searchParams,
    user = await getCurrentUser();
  const status =
      typeof query.status === "string" &&
      TASK_STATUSES.includes(query.status as never)
        ? query.status
        : undefined,
    priority =
      typeof query.priority === "string" &&
      TASK_PRIORITIES.includes(query.priority as never)
        ? query.priority
        : undefined,
    department =
      typeof query.department === "string" &&
      TASK_DEPARTMENTS.includes(query.department as never)
        ? query.department
        : undefined,
    overdue = query.overdue === "1";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [tasks, users] = await Promise.all([
    db.task.findMany({
      where: {
        responsibleUserId: user.id,
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority: priority as never } : {}),
        ...(department ? { department: department as never } : {}),
        ...(overdue ? { dueDate: { lt: today }, status: { not: "DONE" } } : {}),
      },
      include: {
        responsibleUser: true,
        changeRequest: {
          select: {
            id: true,
            number: true,
            title: true,
            machineType: { select: { code: true } },
          },
        },
      },
    }),
    db.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const normalized = sortTasks(
    tasks.map((t) => ({ ...t, status: t.status as TaskStatusKey })),
  ).map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
    overdue: isTaskOverdue(t.dueDate, t.status),
  }));
  return (
    <>
      <PageHeading
        title="Meine Aufgaben"
        description="Ihre zugewiesenen Aufgaben und Fälligkeiten im Überblick."
      />
      <form className="mb-6 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border px-3 py-2"
        >
          <option value="">Alle Status</option>
          {TASK_STATUSES.map((k) => (
            <option key={k} value={k}>
              {TASK_STATUS_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue={priority ?? ""}
          className="rounded-md border px-3 py-2"
        >
          <option value="">Alle Prioritäten</option>
          {TASK_PRIORITIES.map((k) => (
            <option key={k} value={k}>
              {PRIORITY_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          name="department"
          defaultValue={department ?? ""}
          className="rounded-md border px-3 py-2"
        >
          <option value="">Alle Abteilungen</option>
          {TASK_DEPARTMENTS.map((k) => (
            <option key={k} value={k}>
              {DEPARTMENT_LABELS[k]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="overdue"
            value="1"
            defaultChecked={overdue}
          />
          Überfällig
        </label>
        <button className="rounded-md bg-[#175f91] px-4 py-2 text-sm font-semibold text-white sm:col-start-4">
          Filtern
        </button>
      </form>
      <TaskList
        tasks={normalized}
        users={users}
        currentUserId={user.id}
        isAdmin={user.roles.includes("ADMINISTRATOR")}
      />
    </>
  );
}
