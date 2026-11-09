import crypto from "node:crypto";

/**
 * Signed OAuth `state`.
 *
 * ⚠️ This is a deliberate departure from the Java implementation, which is vulnerable.
 *
 * `YouTubeOAuthService.generateOAuthState` produces `"<userId>-<random8>"`, and the callback —
 * which is `permitAll`, so unauthenticated — recovers the user with
 * `Long.parseLong(state.split("-")[0])`. Nothing signs the state, nothing stores the nonce, and
 * nothing ties the callback to the session that started the flow. Anyone can name any user id.
 *
 * The consequence is not theoretical: induce a victim to complete a Google consent screen whose
 * `state` names the *attacker's* user id, and the victim's YouTube account — with an offline
 * refresh token — is bound to the attacker's Voxlae account, handing over their private channel
 * analytics indefinitely. The reverse direction lets an attacker bind their own channel to
 * someone else's dashboard.
 *
 * So the state is signed here: HMAC-SHA256 over the payload, verified in constant time, with a
 * short expiry so a leaked state is not reusable later. The Java comment anticipated this
 * ("consider using signed/encrypted JWT for state") — it just never happened.
 */

/** OAuth round-trips take seconds; ten minutes is generous and bounds replay. */
const MAX_AGE_SECONDS = 600;

export type OAuthStateMode = "connect" | "reconnect";

export interface OAuthStatePayload {
  /** User the connection will be bound to. */
  u: number;
  /** Random nonce — makes each state unique even for the same user and second. */
  n: string;
  /** Issued at (epoch seconds). */
  t: number;
  m: OAuthStateMode;
  /**
   * Where to send the user after the callback — a *hint*, not a URL.
   *
   * Deliberately a short key that the callback maps through a whitelist. Carrying a real URL here
   * would make the signed state an open-redirect primitive: a valid signature on an attacker-chosen
   * destination is worse than no state at all, because the callback would trust it.
   */
  r?: string;
}

function secret(): Buffer {
  const value = process.env.OAUTH_STATE_SECRET ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error(
      "OAUTH_STATE_SECRET (or JWT_SECRET) must be set to sign OAuth state.",
    );
  }
  return Buffer.from(value, "utf8");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createOAuthState(
  userId: number,
  mode: OAuthStateMode = "connect",
  returnTo?: string | null,
): string {
  const payload: OAuthStatePayload = {
    u: userId,
    n: crypto.randomBytes(8).toString("base64url"),
    t: Math.floor(Date.now() / 1000),
    m: mode,
    ...(returnTo ? { r: returnTo } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export class InvalidOAuthStateError extends Error {
  constructor(reason: string) {
    super(`Invalid OAuth state: ${reason}`);
    this.name = "InvalidOAuthStateError";
  }
}

export function verifyOAuthState(state: string | null | undefined): OAuthStatePayload {
  if (!state) throw new InvalidOAuthStateError("missing");

  const dot = state.lastIndexOf(".");
  if (dot <= 0) throw new InvalidOAuthStateError("malformed");

  const encoded = state.slice(0, dot);
  const provided = state.slice(dot + 1);
  const expected = sign(encoded);

  // Constant-time compare. Buffers must match in length first, or timingSafeEqual throws.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InvalidOAuthStateError("bad signature");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new InvalidOAuthStateError("unreadable payload");
  }

  if (typeof payload.u !== "number" || !Number.isFinite(payload.u)) {
    throw new InvalidOAuthStateError("no user");
  }
  const age = Math.floor(Date.now() / 1000) - payload.t;
  if (!Number.isFinite(age) || age < -60 || age > MAX_AGE_SECONDS) {
    throw new InvalidOAuthStateError("expired");
  }
  return payload;
}
