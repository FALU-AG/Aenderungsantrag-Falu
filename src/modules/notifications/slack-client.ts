export type SlackBlock = Record<string, unknown>;
export type SlackPayload = { toEmail: string; text: string; blocks?: SlackBlock[] };
export type SlackProvider = {
  send(payload: SlackPayload): Promise<{ id: string }>;
  check(): Promise<{ botId: string; team?: string }>;
};
type SlackEnvironment = { [key: string]: string | undefined };
type Fetch = typeof fetch;

const slackUserIds = new Map<string, string>();

function enabled(env: SlackEnvironment) {
  const value = env.SLACK_NOTIFICATIONS_ENABLED ?? "false";
  if (value !== "true" && value !== "false") throw new Error("SLACK_NOTIFICATIONS_ENABLED muss true oder false sein.");
  return value === "true";
}

async function slackApi<T extends { ok: boolean; error?: string }>(method: string, token: string, fetcher: Fetch, init?: RequestInit) {
  const response = await fetcher(`https://slack.com/api/${method}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8", ...init?.headers } });
  if (!response.ok) throw new Error(`Slack API nicht erreichbar (${response.status}).`);
  const result = (await response.json()) as T;
  if (!result.ok) {
    if (result.error === "users_not_found") throw new Error("Kein Slack-Benutzer für diese E-Mail-Adresse gefunden.");
    throw new Error(`Slack API-Aufruf ${method} fehlgeschlagen.`);
  }
  return result;
}

export function createSlackProvider(env: SlackEnvironment = process.env, fetcher: Fetch = fetch): SlackProvider {
  if (!enabled(env)) return { send: async () => ({ id: "disabled" }), check: async () => ({ botId: "disabled" }) };
  const token = env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("Slack ist aktiviert, aber SLACK_BOT_TOKEN fehlt.");

  async function resolveUserId(email: string) {
    const normalized = email.trim().toLowerCase();
    const cached = slackUserIds.get(normalized);
    if (cached) return cached;
    const result = await slackApi<{ ok: boolean; error?: string; user?: { id?: string } }>(`users.lookupByEmail?email=${encodeURIComponent(normalized)}`, token!, fetcher);
    if (!result.user?.id) throw new Error("Slack-Benutzer besitzt keine gültige ID.");
    slackUserIds.set(normalized, result.user.id);
    return result.user.id;
  }

  return {
    async send(payload) {
      const channel = await resolveUserId(payload.toEmail);
      const result = await slackApi<{ ok: boolean; error?: string; ts?: string }>("chat.postMessage", token, fetcher, { method: "POST", body: JSON.stringify({ channel, text: payload.text, blocks: payload.blocks }) });
      if (!result.ts) throw new Error("Slack lieferte keine Nachrichten-ID.");
      return { id: `slack:${channel}:${result.ts}` };
    },
    async check() {
      const result = await slackApi<{ ok: boolean; error?: string; bot_id?: string; team?: string }>("auth.test", token, fetcher, { method: "POST", body: "{}" });
      if (!result.bot_id) throw new Error("Slack lieferte keine Bot-Identität.");
      return { botId: result.bot_id, team: result.team };
    },
  };
}

export function clearSlackUserCache() {
  slackUserIds.clear();
}
