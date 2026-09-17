import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { clearSlackUserCache, createSlackProvider } from "./slack-provider";

const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Slack provider", () => {
  beforeEach(() => clearSlackUserCache());

  it("resolves users by normalized email and sends a DM", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ ok: true, user: { id: "U123" } }))
      .mockResolvedValueOnce(response({ ok: true, ts: "1723.42" }));
    const provider = createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_BOT_TOKEN: "xoxb-secret" }, fetcher);
    await expect(provider.send({ toEmail: " User@Falu.ch ", text: "Test", blocks: [] })).resolves.toEqual({ id: "slack:U123:1723.42" });
    expect(fetcher.mock.calls[0][0]).toContain("users.lookupByEmail?email=user%40falu.ch");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(expect.objectContaining({ channel: "U123", text: "Test" }));
  });

  it("preserves production recipient lookup when production mode is explicit", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ok: true, user: { id: "U456" } })).mockResolvedValueOnce(response({ ok: true, ts: "1.2" }));
    await createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_NOTIFICATION_MODE: "production", SLACK_BOT_TOKEN: "token" }, fetcher).send({ toEmail: "real@falu.ch", recipientName: "Real User", text: "Original" });
    expect(fetcher.mock.calls[0][0]).toContain("users.lookupByEmail?email=real%40falu.ch");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ channel: "U456", text: "Original" });
  });

  it("redirects test mode directly to the configured Slack User ID without email lookup", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true, ts: "2.3" }));
    await createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_NOTIFICATION_MODE: "test", SLACK_TEST_RECIPIENT_USER_ID: "U0A4HKAVD8U", SLACK_BOT_TOKEN: "token" }, fetcher).send({ toEmail: "max@falu.ch", recipientName: "Max Bodmer", text: "Freigabe erforderlich", blocks: [{ type: "section", text: { type: "mrkdwn", text: "Original block" } }] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("chat.postMessage");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.channel).toBe("U0A4HKAVD8U");
    expect(body.text).toContain("🧪 TESTMODUS\nUrsprünglicher Empfänger: Max Bodmer (max@falu.ch)");
    expect(JSON.stringify(body.blocks)).toContain("Original block");
  });

  it("keeps multiple intended recipients as separate redirected messages", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response({ ok: true, ts: "3.4" }));
    const provider = createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_NOTIFICATION_MODE: "test", SLACK_TEST_RECIPIENT_USER_ID: "UTEST", SLACK_BOT_TOKEN: "token" }, fetcher);
    await provider.send({ toEmail: "max@falu.ch", recipientName: "Max", text: "One" });
    await provider.send({ toEmail: "florian@falu.ch", recipientName: "Florian", text: "Two" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const messages = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(messages.map((message) => message.channel)).toEqual(["UTEST", "UTEST"]);
    expect(messages[0].text).toContain("Max (max@falu.ch)");
    expect(messages[1].text).toContain("Florian (florian@falu.ch)");
  });

  it("still redirects when the test user is also the intended recipient", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true, ts: "4.5" }));
    await createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_NOTIFICATION_MODE: "test", SLACK_TEST_RECIPIENT_USER_ID: "UORIGINAL", SLACK_BOT_TOKEN: "token" }, fetcher).send({ toEmail: "tester@falu.ch", recipientName: "Tester", text: "Original" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ channel: "UORIGINAL", text: expect.stringContaining("Tester (tester@falu.ch)") });
  });

  it.each([
    { mode: { SLACK_NOTIFICATION_MODE: "test" }, label: "missing test recipient" },
    { mode: { SLACK_NOTIFICATION_MODE: "test", SLACK_TEST_RECIPIENT_USER_ID: "   " }, label: "blank test recipient" },
    { mode: { SLACK_NOTIFICATION_MODE: "preview", SLACK_TEST_RECIPIENT_USER_ID: "UTEST" }, label: "invalid mode" },
  ])("suppresses delivery fail-safe for $label", async ({ mode }) => {
    const fetcher = vi.fn(); const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const provider = createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_BOT_TOKEN: "token", ...mode }, fetcher);
    await expect(provider.send({ toEmail: "real@falu.ch", text: "Never send" })).resolves.toEqual({ id: "disabled" });
    expect(fetcher).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled(); error.mockRestore();
  });

  it("caches a resolved Slack user id", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ ok: true, user: { id: "U123" } }))
      .mockImplementation(async () => response({ ok: true, ts: "1723.42" }));
    const provider = createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_BOT_TOKEN: "xoxb-secret" }, fetcher);
    await provider.send({ toEmail: "user@falu.ch", text: "One" });
    await provider.send({ toEmail: "user@falu.ch", text: "Two" });
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("lookupByEmail"))).toHaveLength(1);
  });

  it("handles a missing Slack user without leaking the token", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: false, error: "users_not_found" }));
    const provider = createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_BOT_TOKEN: "xoxb-secret" }, fetcher);
    await expect(provider.send({ toEmail: "missing@falu.ch", text: "Test" })).rejects.toThrow("Kein Slack-Benutzer");
    await expect(provider.send({ toEmail: "missing@falu.ch", text: "Test" })).rejects.not.toThrow("xoxb-secret");
  });

  it("checks bot identity without sending a message", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ ok: true, bot_id: "B123", team: "FALU" }));
    await expect(createSlackProvider({ SLACK_NOTIFICATIONS_ENABLED: "true", SLACK_BOT_TOKEN: "token" }, fetcher).check()).resolves.toEqual({ botId: "B123", team: "FALU" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain("auth.test");
  });
});
