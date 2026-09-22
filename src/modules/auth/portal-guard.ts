import { createHash } from "node:crypto";
import { verifyAppAssertion } from "./app-assertion";

export class DomainError extends Error { constructor(message: string, public status: number) { super(message); } }
export const MAX_AUTH_BODY_BYTES = 21 * 1024 * 1024;
export async function authenticatePortalRequest(request: Request, publicKey: string, issuer: string, consume: (id: string, expiresAt: Date) => Promise<void>) {
  const assertion = request.headers.get("x-falu-assertion");
  if (!assertion) throw new DomainError("Zentrale Anmeldung erforderlich.", 401);
  try {
    const claims = verifyAppAssertion(assertion, publicKey, issuer);
    const url = new URL(request.url);
    if (claims.method !== request.method || claims.target !== url.pathname + url.search) throw new Error("binding");
    const hash = createHash("sha256");
    let length = 0;
    const reader = request.clone().body?.getReader();
    if (reader) while (true) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > MAX_AUTH_BODY_BYTES) { await reader.cancel(); throw new Error("body size"); } hash.update(next.value); }
    if (hash.digest("hex") !== claims.bodyHash) throw new Error("binding");
    // Persistent unique key prevents replay across processes and Railway replicas.
    await consume(claims.jti, new Date(claims.exp * 1000));
    if (!claims.roles.length) throw new Error("roles required");
    return claims;
  } catch { throw new DomainError("Kein Zugriff", 403); }
}
