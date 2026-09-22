/**
 * Browser-test harness: stands in for the portal and the Cloudflare adapter.
 *
 * The application has no login of its own any more, so a browser cannot reach it directly.
 * In production the public host serves both the portal and the routed application; this
 * harness mirrors that on one loopback origin:
 *
 *   browser -> harness (mints a request-bound assertion) -> next dev
 *
 * It signs with a keypair generated at startup, so no key material is stored anywhere. Which
 * person a request belongs to comes from an `e2e-identity` cookie that the test sets - it
 * replaces signing in, and the `/logout` stub clears it so the real Abmelden link works too.
 *
 * It also brings its own database. The tests create, change and delete requests, tasks and audit
 * entries, so they must never touch a real one: the harness starts a throwaway PostgreSQL
 * instance, migrates and seeds it, and removes it afterwards. The ambient DATABASE_URL is
 * deliberately ignored, which is what makes reaching production impossible rather than merely
 * discouraged. No local setup is required.
 *
 * Everything here is test scaffolding. The application still verifies every assertion itself.
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createSocketServer } from "node:net";
import { generateKeyPairSync, sign, randomBytes, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { SAMPLE_USERS } from "../src/modules/auth/sample-users";
import { centralId } from "./harness-identity";
import { DATABASE_URL_FILE, E2E_DATABASE_DIR } from "./database";

const HARNESS_PORT = Number(process.env.FALU_E2E_PORT ?? 3100);
const APP_PORT = Number(process.env.FALU_E2E_APP_PORT ?? 3001);
const PREFIX = "/aenderungsantrag";
const ORIGIN = `http://127.0.0.1:${HARNESS_PORT}`;
const TTL = 15;

const keys = generateKeyPairSync("ed25519", { privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const directorySecret = randomBytes(32).toString("hex");
const runDir = resolve(E2E_DATABASE_DIR, `run-${randomBytes(6).toString("hex")}`);

const identities = SAMPLE_USERS.map((user) => ({ id: centralId(user.id), name: user.name, email: user.email, roles: user.roles }));

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signed = (payload: object) => { const encoded = base64url(payload); return `${encoded}.${sign(null, Buffer.from(encoded, "ascii"), keys.privateKey).toString("base64url")}`; };

function body(request: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
const readCookie = (request: IncomingMessage, name: string) =>
  (request.headers.cookie ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);

function page(response: ServerResponse, status: number, html: string, cookie?: string) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...(cookie ? { "set-cookie": cookie } : {}) });
  response.end(html);
}

/** Mirrors the portal's signed user directory, including the caller-supplied nonce. */
function directory(request: IncomingMessage, response: ServerResponse) {
  const nonce = request.headers["x-directory-nonce"];
  if (request.headers.authorization !== `Bearer ${directorySecret}` || typeof nonce !== "string") { response.writeHead(401).end(); return; }
  const iat = Math.floor(Date.now() / 1000);
  response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify({ assertion: signed({ iss: ORIGIN, aud: "CHANGE_REQUEST_DIRECTORY", nonce, iat, exp: iat + TTL, users: identities }) }));
}

/** Mints one single-use assertion bound to exactly this method, target and body. */
function assertionFor(identity: (typeof identities)[number], method: string, target: string, payload: Buffer) {
  const iat = Math.floor(Date.now() / 1000);
  return signed({
    v: 1, iss: ORIGIN, aud: "CHANGE_REQUEST", sub: identity.id, name: identity.name, roles: identity.roles,
    iat, exp: iat + TTL, jti: randomBytes(32).toString("hex"),
    method, target, bodyHash: createHash("sha256").update(payload).digest("hex"),
  });
}

async function forward(request: IncomingMessage, response: ServerResponse) {
  const target = request.url ?? "/";
  const payload = await body(request);
  const identity = identities.find((entry) => entry.id === readCookie(request, "e2e-identity"));

  const headers: Record<string, string | string[]> = { ...request.headers } as Record<string, string | string[]>;
  delete headers.cookie;
  // The body is read in full above and sent with an explicit length. Forwarding the original
  // framing headers alongside that makes the upstream wait for data that never comes: the
  // browser sends form submissions chunked, so this is what hung every server action.
  delete headers["content-length"];
  delete headers["transfer-encoding"];
  // Next compares the Origin header against the host it believes it is served on, so the
  // application must see the harness origin rather than its own port.
  headers.host = `127.0.0.1:${HARNESS_PORT}`;
  if (identity) headers["x-falu-assertion"] = assertionFor(identity, request.method ?? "GET", target, payload);
  if (payload.length) headers["content-length"] = String(payload.length);

  const upstream = httpRequest({ host: "127.0.0.1", port: APP_PORT, method: request.method, path: target, headers }, (result) => {
    // Connection-level headers belong to the hop we just terminated. Passing the upstream's
    // framing on while Node applies its own encodes the body twice, and the browser then waits
    // for a stream that never ends - which is what stalled every streamed action response.
    const headers = { ...result.headers };
    for (const name of ["transfer-encoding", "connection", "keep-alive"]) delete headers[name];
    response.writeHead(result.statusCode ?? 502, headers);
    result.pipe(response);
  });
  upstream.on("error", (error) => { console.error(`harness: upstream ${request.method} ${target} failed: ${error.message}`); if (!response.headersSent) response.writeHead(502); response.end(); });
  if (payload.length) upstream.write(payload);
  upstream.end();
}

const server = createServer((request, response) => {
  const path = (request.url ?? "/").split("?")[0];
  if (path === "/api/internal/change-request/directory") return directory(request, response);
  if (path === "/logout") return page(response, 200, "<!doctype html><title>Abgemeldet</title><h1>Abgemeldet</h1>", "e2e-identity=; Path=/; Max-Age=0");
  if (path === "/login") return page(response, 200, "<!doctype html><title>Anmelden</title><h1>Anmelden</h1>");
  if (path === PREFIX || path.startsWith(`${PREFIX}/`)) { void forward(request, response); return; }
  page(response, 404, "<!doctype html><title>Nicht gefunden</title>");
});

let app: ChildProcess | undefined;
let postgres: EmbeddedPostgres | undefined;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  app?.kill();
  server.close();
  // Windows holds the data directory briefly after shutdown; leftovers are ignored by git.
  try { await postgres?.stop(); } catch { /* removed on the next run */ }
  try { await rm(runDir, { recursive: true, force: true }); } catch { /* as above */ }
  process.exit(code);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

function freePort() {
  return new Promise<number>((ok) => {
    const socket = createSocketServer();
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      if (!address || typeof address === "string") throw new Error("port");
      socket.close(() => ok(address.port));
    });
  });
}
function run(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((ok, fail) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", windowsHide: true });
    child.on("error", fail);
    child.on("exit", (code) => code === 0 ? ok() : fail(new Error(`Test setup failed: ${args[0]}`)));
  });
}

async function start() {
  // Playwright terminates its web server abruptly, so on Windows a previous run can leave a
  // postgres process holding its data directory. A fresh directory per run means such a
  // leftover can never block the next start; sweeping the old ones is best effort.
  await mkdir(E2E_DATABASE_DIR, { recursive: true });
  await rm(runDir, { recursive: true, force: true }).catch(() => undefined);

  const password = randomBytes(24).toString("hex");
  const port = await freePort();
  postgres = new EmbeddedPostgres({ databaseDir: resolve(runDir, "data"), port, user: "postgres", password, persistent: false, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
  await postgres.initialise();
  await postgres.start();
  const client = postgres.getPgClient();
  await client.connect();
  await client.query("CREATE DATABASE falu_e2e TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");
  await client.end();

  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/falu_e2e`;
  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "development" as const };
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
  await run(["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], env);
  // The specs need the same connection; Playwright cannot hand it back from the web server.
  await writeFile(DATABASE_URL_FILE, databaseUrl);

  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(APP_PORT)], {
    // Both streams go to stderr: Playwright shows a web server's stderr but swallows its stdout,
    // and without the application's own log a failing run gives nothing to work with.
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: {
      ...env,
      FALU_APP_SIGNING_PUBLIC_KEY: keys.publicKey,
      FALU_CHANGE_REQUEST_DIRECTORY_SECRET: directorySecret,
      FALU_PORTAL_ORIGIN: ORIGIN,
      FALU_PORTAL_SERVICE_ORIGIN: ORIGIN,
      APP_BASE_URL: `${ORIGIN}${PREFIX}`,
    },
  });
  app.stdout?.pipe(process.stderr);
  app.stderr?.pipe(process.stderr);
  app.on("exit", (code) => void shutdown(code ?? 1));

  // Only accept browser traffic once the application actually answers. Playwright waits on this
  // listener, so starting it earlier would let the first test run against a dead upstream.
  for (let attempt = 0; attempt < 600; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${APP_PORT}${PREFIX}/api/health`)).ok) break; } catch { /* still starting */ }
    if (app.exitCode !== null) throw new Error("The application stopped while starting up.");
    await new Promise((ok) => setTimeout(ok, 250));
  }
  await new Promise<void>((ok) => server.listen(HARNESS_PORT, "127.0.0.1", ok));
  console.log(`Browser-test harness on ${ORIGIN}, application on port ${APP_PORT}, throwaway database on port ${port}`);
}

start().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Browser-test harness failed to start.");
  await shutdown(1);
});
