import type { TaskPriority, TaskStatus } from "@prisma/client";

const zurichParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
);

export function isZurichRunTime(now: Date, mondayOnly = false) {
  const parts = zurichParts(now);
  return parts.hour === "08" && (!mondayOnly || parts.weekday === "Mon");
}

export function zurichDateKey(date: Date) {
  const parts = zurichParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function zurichIsoWeekKey(date: Date) {
  const dateKey = zurichDateKey(date);
  const [year, month, day] = dateKey.split("-").map(Number);
  const thursday = new Date(Date.UTC(year, month - 1, day));
  const weekday = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function addDateDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export type DigestTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  changeRequest: { id: string; number: string; title: string };
};

export function groupDigestTasks(tasks: DigestTask[], now: Date) {
  const today = zurichDateKey(now);
  const nextMonday = addDateDays(today, 7);
  const groups = { overdue: [] as DigestTask[], dueThisWeek: [] as DigestTask[], other: [] as DigestTask[] };
  for (const task of tasks.filter(({ status }) => status !== "DONE")) {
    const due = task.dueDate ? zurichDateKey(task.dueDate) : null;
    if (due && due < today) groups.overdue.push(task);
    else if (due && due < nextMonday) groups.dueThisWeek.push(task);
    else groups.other.push(task);
  }
  return groups;
}
