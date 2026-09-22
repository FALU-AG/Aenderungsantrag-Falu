import { createPublicKey, verify } from "node:crypto";
import { z } from "zod";
export const APP_ASSERTION_TTL = 15;
export const applicationRoles = ["EMPLOYEE", "AVOR", "TECHNICAL", "ADMINISTRATOR"] as const;
export const requestBindingSchema = z.object({
  method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]),
  target: z.string().max(4096).refine((value) => {
    if (!/^\/aenderungsantrag(?:[/?]|$)/.test(value) || /[\\#\x00-\x20]/.test(value)) return false;
    const url = new URL(value, "https://binding.invalid");
    return url.origin === "https://binding.invalid" && url.pathname + url.search === value;
  }),
  bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const appAssertionSchema = requestBindingSchema.extend({
  v: z.literal(1), iss: z.string().url(), aud: z.literal("CHANGE_REQUEST"),
  sub: z.string().min(1).max(128), name: z.string().min(1).max(180),
  roles: z.array(z.enum(applicationRoles)).max(4),
  iat: z.number().int(), exp: z.number().int(), jti: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type AppAssertion = z.infer<typeof appAssertionSchema>;
export function verifyAppAssertion(value: string, publicKey: string, issuer: string, now = Date.now()): AppAssertion {
  if (value.length > 10000) throw new Error("Invalid application assertion");
  const parts = value.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("Invalid application assertion");
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(parts[0], "ascii"), key, Buffer.from(parts[1], "base64url"))) throw new Error("Invalid application assertion");
  const claims = appAssertionSchema.parse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
  const seconds = Math.floor(now / 1000);
  if (claims.iss !== issuer || claims.iat > seconds || claims.exp <= seconds || claims.exp <= claims.iat || claims.exp - claims.iat > APP_ASSERTION_TTL) throw new Error("Invalid application assertion");
  return claims;
}
