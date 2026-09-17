import { describe, expect, it } from "vitest";
import { canManageDelegation, canManageOwnDelegations, delegatableScopes, delegationInputSchema, delegationMateriallyChanged, delegationStatus, parseZurichDateTimeLocal, shouldNotifyManualCancellation } from "./domain";

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
  it("exposes self-service only for explicit AVOR or Technical responsibility", () => {
    expect(canManageOwnDelegations(["EMPLOYEE"])).toBe(false);
    expect(delegatableScopes(["AVOR"])).toEqual(["AVOR_APPROVAL"]);
    expect(delegatableScopes(["TECHNICAL"])).toEqual(["TECHNICAL_APPROVAL"]);
    expect(delegatableScopes(["AVOR", "TECHNICAL"])).toEqual(["AVOR_APPROVAL", "TECHNICAL_APPROVAL"]);
    expect(canManageOwnDelegations(["ADMINISTRATOR"])).toBe(false);
  });
  it("enforces scope ownership server-side while retaining administrator management", () => {
    expect(canManageDelegation({ id: "employee", roles: ["EMPLOYEE"] }, "employee", "AVOR_APPROVAL")).toBe(false);
    expect(canManageDelegation({ id: "avor", roles: ["AVOR"] }, "avor", "AVOR_APPROVAL")).toBe(true);
    expect(canManageDelegation({ id: "avor", roles: ["AVOR"] }, "avor", "TECHNICAL_APPROVAL")).toBe(false);
    expect(canManageDelegation({ id: "technical", roles: ["TECHNICAL"] }, "technical", "TECHNICAL_APPROVAL")).toBe(true);
    expect(canManageDelegation({ id: "admin", roles: ["ADMINISTRATOR"] }, "avor", "AVOR_APPROVAL")).toBe(true);
  });
  it("does not notify or update for a no-op and does not notify natural expiration", () => {
    const stored = { substituteUserId: "sub", scope: "AVOR_APPROVAL" as const, startsAt: new Date("2026-09-21T00:00:00Z"), endsAt: new Date("2026-10-04T00:00:00Z") };
    expect(delegationMateriallyChanged(stored, { ...stored })).toBe(false);
    expect(delegationMateriallyChanged(stored, { ...stored, substituteUserId: "new-sub" })).toBe(true);
    expect(shouldNotifyManualCancellation({ enabled: true, endsAt: stored.endsAt }, new Date("2026-09-22T00:00:00Z"))).toBe(true);
    expect(shouldNotifyManualCancellation({ enabled: true, endsAt: stored.endsAt }, new Date("2026-10-05T00:00:00Z"))).toBe(false);
  });
});
