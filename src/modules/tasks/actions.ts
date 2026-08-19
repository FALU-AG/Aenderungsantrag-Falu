"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db/client";
import { getCurrentUser } from "@/modules/auth";
import { requirePermission } from "@/modules/authorization/permissions";
import {
  completionMetadata,
  DEPARTMENT_LABELS,
  taskAccess,
  taskAudit,
  taskSchema,
  TASK_STATUS_LABELS,
  type TaskStatusKey,
} from "./domain";
export type TaskActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: string;
};
function input(f: FormData) {
  return {
    title: String(f.get("title") ?? ""),
    description: String(f.get("description") ?? ""),
    responsibleUserId: String(f.get("responsibleUserId") ?? ""),
    department: String(f.get("department") ?? ""),
    dueDate: String(f.get("dueDate") ?? ""),
    priority: String(f.get("priority") ?? "NORMAL"),
    status: String(f.get("status") ?? "OPEN"),
    requiredForClosure: f.get("requiredForClosure") === "on",
  };
}
function refresh(id: string) {
  revalidatePath("/");
  revalidatePath("/meine-aufgaben");
  revalidatePath(`/change-requests/${id}`);
}
export async function createTask(
  requestId: string,
  _state: TaskActionState,
  f: FormData,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "TASK_CREATE");
  const parsed = taskSchema.safeParse(input(f));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const responsible = await db.user.findFirst({
    where: { id: parsed.data.responsibleUserId, active: true },
    select: { id: true, name: true },
  });
  if (!responsible)
    return {
      message:
        "Die verantwortliche Person ist nicht aktiv oder existiert nicht.",
    };
  await db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        ...parsed.data,
        description: parsed.data.description || null,
        createdById: user.id,
        ...completionMetadata("OPEN", parsed.data.status, user.id),
        changeRequestId: requestId,
      },
    });
    const events = [
      taskAudit("CREATED", user.name, task.title),
      taskAudit("ASSIGNED", user.name, task.title, responsible.name),
    ];
    for (const event of events)
      await tx.auditEvent.create({
        data: {
          changeRequestId: requestId,
          userId: user.id,
          ...event,
          entityType: "Task",
          entityId: task.id,
        },
      });
  });
  refresh(requestId);
  return { success: "Aufgabe erstellt." };
}
export async function updateTask(
  taskId: string,
  _state: TaskActionState,
  f: FormData,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  requirePermission(user, "TASK_UPDATE");
  const parsed = taskSchema.safeParse(input(f));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  await db.$transaction(async (tx) => {
    const old = await tx.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { responsibleUser: true },
    });
    const access = taskAccess(user, {
      ...old,
      status: old.status as TaskStatusKey,
    });
    if (!access.full && !access.responsible)
      throw new Error("Sie dürfen diese Aufgabe nicht bearbeiten.");
    if (!access.canComplete && parsed.data.status === "DONE")
      throw new Error("Sie dürfen diese Aufgabe nicht abschliessen.");
    const responsible = await tx.user.findFirst({
      where: { id: parsed.data.responsibleUserId, active: true },
      select: { id: true, name: true },
    });
    if (!responsible)
      throw new Error(
        "Die verantwortliche Person ist nicht aktiv oder existiert nicht.",
      );
    const permitted = access.full
      ? parsed.data
      : {
          ...parsed.data,
          title: old.title,
          responsibleUserId: old.responsibleUserId!,
          department: old.department,
          priority: old.priority,
          requiredForClosure: old.requiredForClosure,
        };
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        ...permitted,
        description: permitted.description || null,
        ...completionMetadata(
          old.status as TaskStatusKey,
          permitted.status,
          user.id,
        ),
      },
    });
    const events = [] as ReturnType<typeof taskAudit>[];
    if (old.responsibleUserId !== task.responsibleUserId)
      events.push(
        taskAudit("ASSIGNED", user.name, task.title, responsible.name),
      );
    if (old.requiredForClosure !== task.requiredForClosure)
      events.push(taskAudit("CLOSURE_CHANGED", user.name, task.title));
    if (old.status !== task.status) {
      events.push(
        taskAudit(
          task.status === "DONE"
            ? "COMPLETED"
            : old.status === "DONE"
              ? "REOPENED"
              : "STATUS_CHANGED",
          user.name,
          task.title,
          TASK_STATUS_LABELS[task.status],
        ),
      );
    } else events.push(taskAudit("UPDATED", user.name, task.title));
    for (const event of events)
      await tx.auditEvent.create({
        data: {
          changeRequestId: old.changeRequestId,
          userId: user.id,
          ...event,
          entityType: "Task",
          entityId: task.id,
          details: {
            department: DEPARTMENT_LABELS[task.department],
            status: task.status,
          },
        },
      });
  });
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { changeRequestId: true },
  });
  refresh(task.changeRequestId);
  return { success: "Aufgabe aktualisiert." };
}
export async function quickTaskStatus(taskId: string, next: TaskStatusKey) {
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      changeRequestId: true,
      title: true,
      description: true,
      responsibleUserId: true,
      department: true,
      dueDate: true,
      priority: true,
      status: true,
      requiredForClosure: true,
    },
  });
  const f = new FormData();
  for (const [k, v] of Object.entries({
    ...task,
    status: next,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? "",
    description: task.description ?? "",
  }))
    if (k !== "changeRequestId" && v != null) f.set(k, String(v));
  if (task.requiredForClosure) f.set("requiredForClosure", "on");
  await updateTask(taskId, {}, f);
}
export async function deleteOpenTask(taskId: string) {
  const user = await getCurrentUser();
  requirePermission(user, "TASK_UPDATE");
  await db.$transaction(async (tx) => {
    const task = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
    if (
      !taskAccess(user, { ...task, status: task.status as TaskStatusKey })
        .canDelete
    )
      throw new Error(
        "Nur eigene offene Aufgaben oder Administration dürfen gelöscht werden.",
      );
    const audit = taskAudit("DELETED", user.name, task.title);
    await tx.auditEvent.create({
      data: {
        changeRequestId: task.changeRequestId,
        userId: user.id,
        ...audit,
        entityType: "Task",
        entityId: task.id,
      },
    });
    await tx.task.delete({ where: { id: task.id } });
  });
  revalidatePath("/");
  revalidatePath("/meine-aufgaben");
}
