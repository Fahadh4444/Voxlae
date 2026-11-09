import crypto from "node:crypto";

/**
 * Meta webhook signature verification. Ported from `InstagramWebhookController.isValidSignature`.
 *
 * This is the *only* thing standing between a public URL and the automation engine: the endpoint
 * has no JWT (Meta calls it directly), so a forged POST that got past this could make a creator's
 * account reply to comments and send DMs that never happened.
 *
 * Two details matter more than they look:
 *
 *  1. **The HMAC is over the raw request body, byte for byte.** Parsing the JSON and
 *     re-serialising it changes whitespace and key order, so the digest no longer matches. The
 *     route must read `await request.text()` and verify *that* string before parsing it.
 *  2. **Constant-time comparison.** A plain `===` leaks how many leading characters matched,
 *     which is enough to forge a signature byte by byte given enough attempts. Java used
 *     `MessageDigest.isEqual`; this uses `crypto.timingSafeEqual`.
 */
export function isValidMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const secret = process.env.INSTAGRAM_LOGIN_CLIENT_SECRET;
  if (!secret) {
    // Refuse rather than fall open: an unconfigured secret must never mean "accept everything".
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verification handshake. Meta calls this once when the subscription is configured and expects
 * `hub.challenge` echoed back verbatim, but only when the verify token matches.
 */
export function verifyHandshake(params: URLSearchParams): string | null {
  const expected = process.env.INSTAGRAM_LOGIN_WEBHOOK_VERIFY_TOKEN;
  if (!expected) return null;

  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !token || !challenge) return null;

  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return challenge;
}
