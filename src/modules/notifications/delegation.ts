import "server-only";
import { createHash } from "node:crypto";
import { absoluteAppUrl } from "@/lib/app-paths";
import { formatDateZurich } from "@/lib/date-time";
import type { DelegationScopeKey } from "@/modules/delegations/domain";
import { db } from "@/server/db/client";
import { queueNotification } from "./repository";
import { sendNotification } from "./service-core";

export type DelegationNotificationEvent = "CREATED" | "UPDATED" | "CANCELLED" | "REPLACED";
type Person = { id: string; name: string; email: string };
type Input = {
  delegationId: string;
  event: DelegationNotificationEvent;
  delegatingUser: Pick<Person, "id" | "name">;
  substitute: Person;
  scope: DelegationScopeKey;
  startsAt: Date;
  endsAt: Date;
  auditActorId: string;
};

const scopeLabel = (scope: DelegationScopeKey) => scope === "AVOR_APPROVAL" ? "AVOR-Freigaben" : "Technische Freigaben";
const eventTitle: Record<DelegationNotificationEvent, string> = {
  CREATED: "Stellvertretung eingerichtet",
  UPDATED: "Stellvertretung aktualisiert",
  CANCELLED: "Stellvertretung aufgehoben",
  REPLACED: "Stellvertretung aufgehoben",
};

export function delegationNotificationData(input: Omit<Input, "auditActorId">) {
  const cancelled = input.event === "CANCELLED" || input.event === "REPLACED";
  return {
    delegationEvent: input.event,
    heading: eventTitle[input.event],
    delegatorName: input.delegatingUser.name,
    period: `${formatDateZurich(input.startsAt)} – ${formatDateZurich(input.endsAt)}`,
    scope: scopeLabel(input.scope),
    detail: cancelled
      ? `Die Stellvertretung für ${input.delegatingUser.name} wurde aufgehoben. Du erhältst daraus keine weiteren Freigaben mehr.`
      : `${input.delegatingUser.name} hat dich als Stellvertreter eingetragen. Während dieses Zeitraums werden dir die entsprechenden offenen Freigaben in „Meine Aufgaben“ angezeigt.`,
    url: absoluteAppUrl(cancelled ? "/" : "/meine-aufgaben"),
  };
}

function notificationKey(input: Omit<Input, "auditActorId">) {
  const material = [input.event, input.substitute.id, input.scope, input.startsAt.toISOString(), input.endsAt.toISOString()].join(":");
  return `delegation:${input.delegationId}:${createHash("sha256").update(material).digest("hex").slice(0, 20)}`;
}

export async function notifyDelegation(input: Input) {
  const safeInput = { ...input };
  delete (safeInput as Partial<Input>).auditActorId;
  try {
    const row = await queueNotification(db, {
      type: "REQUEST_PHASE_CHANGED",
      idempotencyKey: notificationKey(safeInput),
      recipientUserId: input.substitute.id,
      recipientEmail: input.substitute.email,
      recipientName: input.substitute.name,
      subject: eventTitle[input.event],
      templateData: delegationNotificationData(safeInput),
    });
    return await sendNotification(row.id);
  } catch (error) {
    console.error("Delegation notification could not be queued.", { delegationId: input.delegationId, event: input.event, recipientUserId: input.substitute.id, errorName: error instanceof Error ? error.name : "UnknownError" });
    await db.auditEvent.create({ data: { userId: input.auditActorId, action: "DELEGATION_NOTIFICATION_FAILED", entityType: "ApprovalDelegation", entityId: input.delegationId, summary: "Die Slack-Benachrichtigung zur Stellvertretung konnte nicht vorgemerkt werden.", details: { event: input.event, recipientUserId: input.substitute.id } } }).catch(() => undefined);
    return false;
  }
}
