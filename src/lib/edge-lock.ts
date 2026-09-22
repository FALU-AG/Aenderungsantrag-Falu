/**
 * The application answers at its Railway address as well as behind Cloudflare. Everything the
 * router in front of it does — central identity, cookie stripping, origin checks — happens only
 * on the Cloudflare path, so a request that arrived any other way must not be served.
 *
 * The router marks every request it forwards with a shared secret. Unmarked requests are
 * refused here.
 *
 * While FALU_ORIGIN_LOCK is unset nothing is enforced. That is deliberate and is what makes a
 * rollout possible at all: the router ships first, this application second, and the lock is
 * switched on afterwards by setting the same value on both sides. Unsetting it again turns the
 * lock off without a deployment.
 */
const HEADER = "x-falu-edge";

/** Length is not secret here; the value is. */
function sameValue(presented: string, expected: string) {
  if (presented.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= presented.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function arrivedThroughRouter(headers: Headers) {
  const expected = process.env.FALU_ORIGIN_LOCK?.trim();
  if (!expected) return true;
  return sameValue(headers.get(HEADER) ?? "", expected);
}

/** Names the official address rather than the reason, which nobody outside needs to know. */
export function wrongDoor() {
  return new Response(
    '<!doctype html><html lang="de"><title>Falscher Zugang</title><main><h1>Falscher Zugang</h1><p>Änderungsanträge werden über <a href="https://admin.falu.com/aenderungsantrag">admin.falu.com</a> geöffnet.</p></main></html>',
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
