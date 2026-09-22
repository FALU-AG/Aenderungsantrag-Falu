import type { Prisma } from "@prisma/client";
import { createPublicKey, verify, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db/client";
import { portalOrigin } from "./portal-config";
import { ROLE_KEYS } from "./types";
const schema = z.object({ iss: z.string(), aud: z.literal("CHANGE_REQUEST_DIRECTORY"), nonce: z.string(), iat: z.number().int(), exp: z.number().int(), users: z.array(z.object({ id: z.string().min(1), name: z.string(), email: z.string().email(), roles: z.array(z.enum(ROLE_KEYS)).min(1).max(4) }).strict()) }).strict();
export type DirectoryUser = z.infer<typeof schema>["users"][number];
async function fetchDirectory(): Promise<DirectoryUser[]> {
  const secret = process.env.FALU_CHANGE_REQUEST_DIRECTORY_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error("Zentrales Benutzerverzeichnis nicht verfügbar.");
  const nonce = randomBytes(32).toString("hex");
  const endpoint = process.env.FALU_PORTAL_SERVICE_ORIGIN ?? portalOrigin();
  const url = new URL(endpoint);
  if (url.origin !== endpoint || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["127.0.0.1","localhost"].includes(url.hostname)))) throw new Error("Invalid service origin");
  const response = await fetch(endpoint + "/api/internal/change-request/directory", { method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000), headers: { authorization: "Bearer " + secret, "x-directory-nonce": nonce } });
  if (!response.ok) throw new Error("Zentrales Benutzerverzeichnis nicht verfügbar.");
  const { assertion } = await response.json();
  if (typeof assertion !== "string" || assertion.length > 2000000) throw new Error("Invalid directory");
  const parts = assertion.split(".");
  const key = createPublicKey(process.env.FALU_APP_SIGNING_PUBLIC_KEY!);
  if (parts.length !== 2 || key.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(parts[0],"ascii"),key,Buffer.from(parts[1],"base64url"))) throw new Error("Invalid directory");
  const data = schema.parse(JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")));
  const now = Math.floor(Date.now()/1000);
  if (data.iss !== portalOrigin() || data.nonce !== nonce || data.iat > now || data.exp <= now || data.exp <= data.iat || data.exp-data.iat > 15 || new Set(data.users.map((u)=>u.id)).size !== data.users.length) throw new Error("Invalid directory");
  return data.users;
}

// Each directory lookup is a network round trip to the portal. One request or job
// resolves recipients, owners and substitutes repeatedly, and some of those lookups
// sit inside database transactions. Caching the fetch for the assertion lifetime keeps
// a withdrawn access effective within the documented 15 seconds while removing both
// the duplicate round trips and, together with warmCentralDirectory, the network call
// from inside any transaction. Failures are never cached.
const DIRECTORY_TTL_MS = 15_000;
let cached: { users: DirectoryUser[]; expiresAt: number } | undefined;
let inFlight: Promise<DirectoryUser[]> | undefined;

export async function centralDirectory(): Promise<DirectoryUser[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.users;
  // Concurrent callers share one round trip instead of issuing one request each.
  inFlight ??= fetchDirectory()
    .then((users) => { cached = { users, expiresAt: Date.now() + DIRECTORY_TTL_MS }; return users; })
    .finally(() => { inFlight = undefined; });
  return inFlight;
}

/**
 * Resolves the directory before a transaction opens, so the lookups inside it are
 * served from the cache and the transaction never waits on the portal. Call it
 * immediately before db.$transaction wherever the transaction resolves users.
 *
 * Deliberately best effort: this is an optimisation, not a gate. If the portal is
 * unreachable the lookup inside the transaction fails exactly as it did before, so error
 * handling stays at that one place instead of being duplicated at every warm-up site.
 */
export async function warmCentralDirectory() { await centralDirectory().catch(() => undefined); }

/** Test and job seam: drops the cached directory so the next call fetches again. */
export function resetCentralDirectoryCache() { cached = undefined; inFlight = undefined; }

// Local IDs are domain references only. No email matching or persisted role cache.
export async function centralUsers(client: Prisma.TransactionClient = db) {
  const directory = await centralDirectory();
  const local = await client.user.findMany({ where: { externalId: { in: directory.map((u)=>u.id) } }, select: { id: true, externalId: true } });
  // Sorted by the name that is actually displayed, so every selection list built on this
  // is alphabetical without each caller having to remember to sort.
  return local
    .flatMap((row) => { const user = directory.find((u)=>u.id===row.externalId); return user ? [{ ...user, centralId: user.id, id: row.id, active: true as const, roles: user.roles.map((key)=>({role:{key}})) }] : []; })
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}
export async function centralUser(id: string, client: Prisma.TransactionClient = db) { return (await centralUsers(client)).find((u)=>u.id===id) ?? null; }
