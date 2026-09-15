import { createSlackProvider } from "../src/modules/notifications/slack-client";

async function main() {
  const provider = createSlackProvider({ ...process.env, SLACK_NOTIFICATIONS_ENABLED: "true" });
  const identity = await provider.check();
  console.log(`Slack erreichbar. Bot-ID: ${identity.botId}${identity.team ? `, Workspace: ${identity.team}` : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Slack-Diagnose fehlgeschlagen.");
  process.exitCode = 1;
});
