import { applyResendWebhook, verifyResendWebhook } from "@/modules/notifications/webhook";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const event = verifyResendWebhook(payload, request.headers);
    await applyResendWebhook(event);
    return new Response("OK");
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
