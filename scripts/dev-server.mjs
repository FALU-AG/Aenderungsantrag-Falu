import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const DEV_URL = "http://localhost:3000";

export async function isApplicationReady(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(DEV_URL, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function isPortInUse(port = 3000, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function startDevelopmentServer(spawnImpl = spawn) {
  const windows = process.platform === "win32";
  const command = windows ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = windows ? ["/d", "/s", "/c", "npm run dev"] : ["run", "dev"];
  const child = spawnImpl(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export async function ensureDevelopmentServer({
  ready = isApplicationReady,
  portInUse = isPortInUse,
  start = startDevelopmentServer,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = 30,
} = {}) {
  if (await ready()) return { started: false, url: DEV_URL };
  if (await portInUse())
    throw new Error(
      "Port 3000 ist belegt, antwortet aber nicht als Falu-Anwendung.",
    );
  start();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(1_000);
    if (await ready()) return { started: true, url: DEV_URL };
  }
  throw new Error(
    "Der Entwicklungsserver wurde gestartet, war aber nicht rechtzeitig erreichbar.",
  );
}

async function main() {
  const mode = process.argv[2] ?? "ensure";
  if (mode === "check") {
    if (!(await isApplicationReady()))
      throw new Error(`${DEV_URL} ist nicht erreichbar.`);
    console.log(`${DEV_URL} ist erreichbar.`);
    return;
  }
  const result = await ensureDevelopmentServer();
  console.log(
    result.started
      ? `Entwicklungsserver gestartet: ${result.url}`
      : `Entwicklungsserver läuft bereits: ${result.url}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
