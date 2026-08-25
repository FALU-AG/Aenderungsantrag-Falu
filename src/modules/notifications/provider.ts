import "server-only";
import { Resend } from "resend";

export type EmailPayload = { to: string; subject: string; html: string; text: string; idempotencyKey: string };
export type EmailProvider = { send(payload: EmailPayload): Promise<{ id: string }> };
type EmailEnvironment = { [key: string]: string | undefined };

export function emailMode(env: EmailEnvironment = process.env) {
  const mode = env.EMAIL_MODE ?? "disabled";
  if (!(["disabled", "redirect", "live"] as const).includes(mode as "disabled")) throw new Error("EMAIL_MODE muss disabled, redirect oder live sein.");
  return mode as "disabled" | "redirect" | "live";
}

export function createEmailProvider(env: EmailEnvironment = process.env): EmailProvider {
  const mode = emailMode(env);
  if (mode === "disabled") return { send: async () => ({ id: "disabled" }) };
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Resend ist nicht vollständig konfiguriert.");
  const redirectTo = env.EMAIL_REDIRECT_TO;
  if (mode === "redirect" && !redirectTo) throw new Error("EMAIL_REDIRECT_TO fehlt im redirect-Modus.");
  const resend = new Resend(apiKey);
  return { send: async (payload) => {
    const { data, error } = await resend.emails.send({
      from,
      to: mode === "redirect" ? redirectTo! : payload.to,
      subject: mode === "redirect" ? `[TEST für ${payload.to}] ${payload.subject}` : payload.subject,
      html: payload.html,
      text: payload.text,
    }, { idempotencyKey: payload.idempotencyKey });
    if (error || !data?.id) throw new Error(error?.message ?? "Resend lieferte keine Nachrichten-ID.");
    return { id: data.id };
  } };
}
