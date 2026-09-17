import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createNotificationDeliveryProvider, notificationChannel } from "./delivery";

describe("notification channel routing", () => {
  it.each(["PASSWORD_RESET", "USER_INVITATION"] as const)("keeps %s on email", (type) => {
    expect(notificationChannel(type)).toBe("email");
  });

  it.each(["APPROVAL_REQUIRED_AVOR", "APPROVAL_REQUIRED_TECHNICAL", "REQUEST_CHANGES_REQUIRED", "REQUEST_APPROVED", "TASK_ASSIGNED", "REQUEST_CLOSED", "REQUEST_INACTIVITY_REMINDER", "WEEKLY_TASK_DIGEST"] as const)("moves %s to Slack", (type) => {
    expect(notificationChannel(type)).toBe("slack");
  });

  it("uses email only for password reset", async () => {
    const email = { send: vi.fn().mockResolvedValue({ id: "mail" }) };
    const slack = { send: vi.fn(), check: vi.fn() };
    await createNotificationDeliveryProvider({ email, slack }).send({ type: "PASSWORD_RESET", recipientEmail: "user@falu.ch", subject: "Reset", idempotencyKey: "reset:1", data: { url: "https://admin.falu.com/aenderungsantrag/reset-password?token=x" } });
    expect(email.send).toHaveBeenCalledOnce();
    expect(slack.send).not.toHaveBeenCalled();
  });

  it("sends workflow events only through Slack with the application link", async () => {
    const email = { send: vi.fn() };
    const slack = { send: vi.fn().mockResolvedValue({ id: "slack" }), check: vi.fn() };
    const url = "https://admin.falu.com/aenderungsantrag/change-requests/cr-1";
    await createNotificationDeliveryProvider({ email, slack }).send({ type: "TASK_ASSIGNED", recipientEmail: "user@falu.ch", recipientName: "Erika Beispiel", subject: "Aufgabe", idempotencyKey: "task:1", data: { number: "CR-2026-001", title: "Zeichnung", url } });
    expect(slack.send).toHaveBeenCalledWith(expect.objectContaining({ toEmail: "user@falu.ch", recipientName: "Erika Beispiel", blocks: expect.arrayContaining([expect.objectContaining({ type: "actions", elements: [expect.objectContaining({ url })] })]) }));
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each(["APPROVAL_REQUIRED_AVOR", "REQUEST_CLOSED", "WEEKLY_TASK_DIGEST", "REQUEST_PHASE_CHANGED"] as const)("routes %s through the shared Slack provider", async (type) => {
    const slack = { send: vi.fn().mockResolvedValue({id:"slack"}), check:vi.fn() };
    await createNotificationDeliveryProvider({email:{send:vi.fn()},slack}).send({type,recipientEmail:"recipient@falu.ch",recipientName:"Recipient",subject:"Test",idempotencyKey:`test:${type}`,data:{delegationEvent:type==="REQUEST_PHASE_CHANGED"?"CREATED":undefined}});
    expect(slack.send).toHaveBeenCalledOnce();
  });
});
