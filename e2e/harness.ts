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
 * Everything here is test scaffolding. The application still verifies every assertion itself.
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { generateKeyPairSync, sign, randomBytes, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { SAMPLE_USERS } from "../src/modules/auth/sample-users";
import { centralId } from "./harness-identity";

const HARNESS_PORT = Number(process.env.FALU_E2E_PORT ?? 3100);
const APP_PORT = Number(process.env.FALU_E2E_APP_PORT ?? 3001);
const PREFIX = "/aenderungsantrag";
const ORIGIN = `http://127.0.0.1:${HARNESS_PORT}`;
const TTL = 15;

// Read the same .env the application will read, so the check below sees the value that would
// actually be used rather than an empty environment.
try { process.loadEnvFile(".env"); } catch { /* no local .env: the check below still applies */ }

// The browser tests create, change and delete requests, tasks and audit entries, and the specs
// talk to the database directly to set up and tear down. Against a remote database that is data
// loss, so refuse anything that is not loopback rather than trusting whoever runs this.
const databaseHost = (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname; } catch { return ""; } })();
if (!["127.0.0.1", "localhost", "::1"].includes(databaseHost)) {
  console.error(`Refusing to start: DATABASE_URL points at ${databaseHost || "an unreadable value"}, not a local database.`);
  console.error("Browser tests write and delete data. Start the local database (docker compose up -d) and point DATABASE_URL at it.");
  process.exit(1);
}

const keys = generateKeyPairSync("ed25519", { privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const directorySecret = randomBytes(32).toString("hex");

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
  delete headers["content-length"];
  // Next compares the Origin header against the host it believes it is served on, so the
  // application must see the harness origin rather than its own port.
  headers.host = `127.0.0.1:${HARNESS_PORT}`;
  if (identity) headers["x-falu-assertion"] = assertionFor(identity, request.method ?? "GET", target, payload);
  if (payload.length) headers["content-length"] = String(payload.length);

  const upstream = httpRequest({ host: "127.0.0.1", port: APP_PORT, method: request.method, path: target, headers }, (result) => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
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
function shutdown() { app?.kill(); server.close(); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(HARNESS_PORT, "127.0.0.1", () => {
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(APP_PORT)], {
    stdio: "inherit", windowsHide: true,
    env: {
      ...process.env,
      FALU_APP_SIGNING_PUBLIC_KEY: keys.publicKey,
      FALU_CHANGE_REQUEST_DIRECTORY_SECRET: directorySecret,
      FALU_PORTAL_ORIGIN: ORIGIN,
      FALU_PORTAL_SERVICE_ORIGIN: ORIGIN,
      APP_BASE_URL: `${ORIGIN}${PREFIX}`,
    },
  });
  app.on("exit", (code) => { server.close(); process.exit(code ?? 1); });
  console.log(`Browser-test harness on ${ORIGIN}, application on port ${APP_PORT}`);
});
