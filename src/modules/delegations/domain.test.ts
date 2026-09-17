import { describe, expect, it } from "vitest";
import { delegationInputSchema, delegationStatus, parseZurichDateTimeLocal } from "./domain";

const base = { delegatingUserId: "u1", substituteUserId: "u2", scope: "AVOR_APPROVAL" as const, startsAt: new Date("2026-09-20T08:00:00Z"), endsAt: new Date("2026-09-25T16:00:00Z") };
describe("approval delegation domain", () => {
  it("accepts a valid delegation", () => expect(delegationInputSchema.safeParse(base).success).toBe(true));
  it("rejects self delegation and invalid periods", () => {
    expect(delegationInputSchema.safeParse({ ...base, substituteUserId: "u1" }).success).toBe(false);
    expect(delegationInputSchema.safeParse({ ...base, endsAt: base.startsAt }).success).toBe(false);
  });
  it("derives planned, active, expired and cancelled without cleanup", () => {
    expect(delegationStatus({ ...base, enabled: true }, new Date("2026-09-19T00:00:00Z"))).toBe("PLANNED");
    expect(delegationStatus({ ...base, enabled: true }, new Date("2026-09-21T00:00:00Z"))).toBe("ACTIVE");
    expect(delegationStatus({ ...base, enabled: true }, new Date("2026-09-26T00:00:00Z"))).toBe("EXPIRED");
    expect(delegationStatus({ ...base, enabled: false }, new Date("2026-09-21T00:00:00Z"))).toBe("CANCELLED");
  });
  it("converts Zurich wall time with DST", () => {
    expect(parseZurichDateTimeLocal("2026-08-24T17:15").toISOString()).toBe("2026-08-24T15:15:00.000Z");
    expect(parseZurichDateTimeLocal("2026-01-24T17:15").toISOString()).toBe("2026-01-24T16:15:00.000Z");
  });
});
