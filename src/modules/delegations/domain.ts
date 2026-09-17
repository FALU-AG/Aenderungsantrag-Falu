import { z } from "zod";
import type { ApprovalTypeKey } from "@/modules/approvals/domain";
import type { RoleKey } from "@/modules/auth";

export type DelegationScopeKey = "AVOR_APPROVAL" | "TECHNICAL_APPROVAL";
export const DELEGATION_SCOPE_LABELS: Record<DelegationScopeKey, string> = {
  AVOR_APPROVAL: "AVOR-Freigabe",
  TECHNICAL_APPROVAL: "Technische Freigabe",
};

export const scopeForApproval = (type: ApprovalTypeKey): DelegationScopeKey =>
  type === "AVOR" ? "AVOR_APPROVAL" : "TECHNICAL_APPROVAL";
export const roleForScope = (scope: DelegationScopeKey) =>
  scope === "AVOR_APPROVAL" ? "AVOR" : "TECHNICAL";

export function delegatableScopes(roles: readonly RoleKey[]): DelegationScopeKey[] {
  return [
    ...(roles.includes("AVOR") ? ["AVOR_APPROVAL" as const] : []),
    ...(roles.includes("TECHNICAL") ? ["TECHNICAL_APPROVAL" as const] : []),
  ];
}

export function canManageOwnDelegations(roles: readonly RoleKey[]) {
  return delegatableScopes(roles).length > 0;
}

export function canManageDelegation(actor: { id: string; roles: readonly RoleKey[] }, delegatingUserId: string, scope: DelegationScopeKey) {
  if (actor.id !== delegatingUserId) return actor.roles.includes("ADMINISTRATOR");
  return delegatableScopes(actor.roles).includes(scope);
}

export function delegationMateriallyChanged(existing: { substituteUserId: string; scope: DelegationScopeKey; startsAt: Date; endsAt: Date }, next: { substituteUserId: string; scope: DelegationScopeKey; startsAt: Date; endsAt: Date }) {
  return existing.substituteUserId !== next.substituteUserId || existing.scope !== next.scope || existing.startsAt.getTime() !== next.startsAt.getTime() || existing.endsAt.getTime() !== next.endsAt.getTime();
}

export function shouldNotifyManualCancellation(input: { enabled: boolean; endsAt: Date }, now = new Date()) {
  return input.enabled && input.endsAt > now;
}

export const delegationInputSchema = z.object({
  delegatingUserId: z.string().min(1),
  substituteUserId: z.string().min(1, "Bitte wählen Sie einen Stellvertreter."),
  scope: z.enum(["AVOR_APPROVAL", "TECHNICAL_APPROVAL"]),
  startsAt: z.date(),
  endsAt: z.date(),
}).superRefine((value, ctx) => {
  if (value.delegatingUserId === value.substituteUserId)
    ctx.addIssue({ code: "custom", path: ["substituteUserId"], message: "Sie können sich nicht selbst vertreten." });
  if (value.endsAt <= value.startsAt)
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Bis muss nach Von liegen." });
});

export function delegationStatus(input: { enabled: boolean; startsAt: Date; endsAt: Date }, now = new Date()) {
  if (!input.enabled) return "CANCELLED" as const;
  if (now < input.startsAt) return "PLANNED" as const;
  if (now > input.endsAt) return "EXPIRED" as const;
  return "ACTIVE" as const;
}

export function isDelegationActive(input: { enabled: boolean; startsAt: Date; endsAt: Date }, now = new Date()) {
  return delegationStatus(input, now) === "ACTIVE";
}

export function parseZurichDateTimeLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return new Date(Number.NaN);
  const [, y, m, d, h, min] = match;
  const intended = Date.UTC(+y, +m - 1, +d, +h, +min);
  let result = intended;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    result += intended - represented;
  }
  return new Date(result);
}
