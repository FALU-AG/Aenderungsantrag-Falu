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
