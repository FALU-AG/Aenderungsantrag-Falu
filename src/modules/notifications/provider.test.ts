import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));
vi.mock("server-only", () => ({}));
import { createEmailProvider } from "./provider";

const payload = { to: "employee@falu.ch", subject: "Test", html: "<p>Test</p>", text: "Test", idempotencyKey: "event-1" };
describe("email provider", () => {
  beforeEach(() => send.mockReset());
  it("disabled sends nothing externally", async () => { await expect(createEmailProvider({ EMAIL_MODE: "disabled" }).send(payload)).resolves.toEqual({ id: "disabled" }); expect(send).not.toHaveBeenCalled(); });
  it("redirect mode replaces the recipient", async () => { send.mockResolvedValue({ data: { id: "mail-1" }, error: null }); await createEmailProvider({ EMAIL_MODE: "redirect", EMAIL_REDIRECT_TO: "test@falu.ch", RESEND_API_KEY: "secret-value", EMAIL_FROM: "FALU <noreply@falu.ch>" }).send(payload); expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "test@falu.ch", subject: expect.stringContaining("employee@falu.ch") }), { idempotencyKey: "event-1" }); });
  it("live mode keeps the recipient and creates html/text payload", async () => { send.mockResolvedValue({ data: { id: "mail-2" }, error: null }); await createEmailProvider({ EMAIL_MODE: "live", RESEND_API_KEY: "secret-value", EMAIL_FROM: "FALU <noreply@falu.ch>" }).send(payload); expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: payload.to, html: payload.html, text: payload.text }), expect.anything()); });
  it("never includes an API key in a provider error", async () => { send.mockResolvedValue({ data: null, error: { message: "Nicht autorisiert" } }); await expect(createEmailProvider({ EMAIL_MODE: "live", RESEND_API_KEY: "secret-value", EMAIL_FROM: "FALU <noreply@falu.ch>" }).send(payload)).rejects.not.toThrow("secret-value"); });
});
