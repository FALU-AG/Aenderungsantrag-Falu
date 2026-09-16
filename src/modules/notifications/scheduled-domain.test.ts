import { describe, expect, it } from "vitest";
import type { TaskStatus } from "@prisma/client";
import { groupDigestTasks, isZurichRunTime, zurichIsoWeekKey } from "./scheduled-domain";

const task = (id: string, dueDate: string | null, status: TaskStatus = "OPEN") => ({ id, title: id, dueDate: dueDate ? new Date(dueDate) : null, priority: "HIGH" as const, status, changeRequest: { id: `cr-${id}`, number: `CR-${id}`, title: "Antrag" } });

describe("scheduled notification domain", () => {
  const now = new Date("2026-08-24T06:00:00Z");

  it("recognizes 08:00 Zurich in summer and winter without fixed UTC offsets", () => {
    expect(isZurichRunTime(new Date("2026-08-24T06:00:00Z"), true)).toBe(true);
    expect(isZurichRunTime(new Date("2026-01-05T07:00:00Z"), true)).toBe(true);
    expect(isZurichRunTime(new Date("2026-08-24T07:00:00Z"), true)).toBe(false);
  });

  it("uses an ISO year/week key across the same Zurich week", () => {
    expect(zurichIsoWeekKey(new Date("2026-08-24T06:00:00Z"))).toBe("2026-W35");
    expect(zurichIsoWeekKey(new Date("2026-08-30T20:00:00Z"))).toBe("2026-W35");
    expect(zurichIsoWeekKey(new Date("2026-08-31T06:00:00Z"))).toBe("2026-W36");
  });

  it("groups overdue, current-week and remaining open tasks and excludes DONE", () => {
    const groups = groupDigestTasks([task("old", "2026-08-23T12:00:00Z"), task("week", "2026-08-28T12:00:00Z"), task("later", "2026-09-01T12:00:00Z"), task("none", null), task("done", "2026-08-23T12:00:00Z", "DONE")], now);
    expect(groups.overdue.map(({ id }) => id)).toEqual(["old"]);
    expect(groups.dueThisWeek.map(({ id }) => id)).toEqual(["week"]);
    expect(groups.other.map(({ id }) => id)).toEqual(["later", "none"]);
  });
});
