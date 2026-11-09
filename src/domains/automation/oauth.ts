import { sql } from "drizzle-orm";
import { db } from "@/db";
import { encryptToken } from "@/domains/platform/token-crypto";
import { createOAuthState, verifyOAuthState } from "@/domains/platform/oauth-state";
import { fetchAccountInfo, subscribeWebhooks } from "./graph-client";

/**
 * Instagram Login OAuth for automations. Ports `InstagramLoginOAuthService`.
 *
 * Separate from the YouTube flow and from Google *sign-in*: this authorises a creator's Instagram
 * account for comment and message automation, and the token it yields is the one every send uses.
 */

const AUTH_URI = "https://www.instagram.com/oauth/authorize";
const TOKEN_URI = "https://api.instagram.com/oauth/access_token";
const GRAPH_BASE = process.env.INSTAGRAM_GRAPH_BASE_URL ?? "https://graph.instagram.com";
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
];
/** Meta's default long-lived lifetime when `expires_in` is omitted. */
const DEFAULT_TTL_SECONDS = 5_184_000;

export class IgOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgOAuthError";
  }
}

export function buildAuthorizationUrl(userId: number, returnTo?: string | null): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_LOGIN_CLIENT_ID ?? "",
    redirect_uri: process.env.INSTAGRAM_LOGIN_REDIRECT_URI ?? "",
    response_type: "code",
    // Comma-separated, not space — Instagram Login differs from Google here.
    scope: SCOPES.join(","),
    state: createOAuthState(userId, "connect", returnTo),
  });
  return `${AUTH_URI}?${params.toString()}`;
}

/**
 * Map the state's return hint onto a known UI path.
 *
 * Whitelisted, so a tampered or unexpected value lands on Automations rather than anywhere the
 * value names. Connecting from My Platforms should return to My Platforms.
 */
export function resolveReturnPath(returnTo: string | null | undefined): string {
  return returnTo === "platforms" ? "/influencer/platforms" : "/influencer/automations";
}

interface ShortLivedToken {
  accessToken: string;
  userId: string | null;
}

async function exchangeAuthorizationCode(code: string): Promise<ShortLivedToken> {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_LOGIN_CLIENT_ID ?? "",
    client_secret: process.env.INSTAGRAM_LOGIN_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    redirect_uri: process.env.INSTAGRAM_LOGIN_REDIRECT_URI ?? "",
    code,
  });

  let body: Record<string, unknown>;
  try {
    const response = await fetch(TOKEN_URI, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    body = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new IgOAuthError(
      `Failed to exchange authorization code: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  // Instagram reports failure as `error_type`/`error_message`, not the `error` object Meta's Graph
  // API uses, and often with HTTP 200 — so the status alone proves nothing.
  if (body.error_type || body.error) {
    const err = body.error as { message?: string } | undefined;
    throw new IgOAuthError(
      `Token exchange failed: ${(body.error_message as string) ?? err?.message ?? "unknown"}`,
    );
  }
  if (typeof body.access_token !== "string") {
    throw new IgOAuthError("Token exchange returned no access_token");
  }
  return {
    accessToken: body.access_token,
    userId: body.user_id != null ? String(body.user_id) : null,
  };
}

/** Trade the ~1h token for the ~60 day one. Only the long-lived token is ever stored. */
async function exchangeForLongLivedToken(
  shortLived: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url =
    `${GRAPH_BASE}/access_token?grant_type=ig_exchange_token` +
    `&client_secret=${encodeURIComponent(process.env.INSTAGRAM_LOGIN_CLIENT_SECRET ?? "")}` +
    `&access_token=${encodeURIComponent(shortLived)}`;
  let body: Record<string, unknown>;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    body = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new IgOAuthError(
      `Failed to obtain long-lived token: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (body.error || typeof body.access_token !== "string") {
    const err = body.error as { message?: string } | undefined;
    throw new IgOAuthError(`Long-lived token exchange failed: ${err?.message ?? "unknown"}`);
  }
  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : DEFAULT_TTL_SECONDS,
  };
}

export interface ConnectResult {
  connectionId: string;
  igUserId: string;
  username: string | null;
  webhookSubscribed: boolean;
  returnTo: string | null;
}

/** Full callback flow: verify state, exchange, persist, subscribe. */
export async function exchangeCodeForConnection(
  code: string,
  state: string,
): Promise<ConnectResult> {
  const payload = verifyOAuthState(state);
  const userId = payload.u;

  const shortLived = await exchangeAuthorizationCode(code);
  const longLived = await exchangeForLongLivedToken(shortLived.accessToken);
  const account = await fetchAccountInfo(longLived.accessToken);
  const igUserId = account?.igUserId ?? shortLived.userId;
  if (!igUserId) throw new IgOAuthError("Could not resolve the Instagram account id");

  // An IG account may only be automated by one Voxlae user. Without this, two users could both
  // connect the same account and each would receive the other's webhooks.
  const owner = await db.execute<{ [key: string]: unknown; user_id: number }>(sql`
    SELECT user_id FROM ig_automation_connections WHERE ig_user_id = ${igUserId}
  `);
  if (owner[0] && Number(owner[0].user_id) !== userId) {
    throw new IgOAuthError(
      "This Instagram account is already connected for automations by another user.",
    );
  }

  const expiresAt = new Date(Date.now() + longLived.expiresIn * 1000).toISOString();
  const rows = await db.execute<{ [key: string]: unknown; id: string }>(sql`
    INSERT INTO ig_automation_connections
      (user_id, ig_user_id, username, account_avatar_url, access_token, token_expiry, scopes,
       status, connected_at, updated_at)
    VALUES (${userId}, ${igUserId}, ${account?.username ?? null},
            ${account?.profilePictureUrl ?? null}, ${encryptToken(longLived.accessToken)},
            ${expiresAt}, ${SCOPES.join(",")}, 'CONNECTED', now(), now())
    ON CONFLICT (ig_user_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      username = EXCLUDED.username,
      account_avatar_url = COALESCE(EXCLUDED.account_avatar_url,
                                    ig_automation_connections.account_avatar_url),
      access_token = EXCLUDED.access_token,
      token_expiry = EXCLUDED.token_expiry,
      scopes = EXCLUDED.scopes,
      -- Reconnecting an account that was disconnected resumes the same row, so the creator's
      -- automations, keywords and execution history survive.
      status = 'CONNECTED',
      last_refreshed_at = now(),
      updated_at = now()
    RETURNING id
  `);
  const connectionId = String(rows[0].id);

  // Best effort: without it the connection still exists, it just receives no events. The flag is
  // what lets the UI say so rather than the automations silently never firing.
  let webhookSubscribed = false;
  try {
    await subscribeWebhooks(igUserId, longLived.accessToken);
    webhookSubscribed = true;
  } catch (error) {
    console.warn(
      `[ig-oauth] webhook subscribe failed for ${igUserId} (connection kept): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  await db.execute(sql`
    UPDATE ig_automation_connections
    SET webhook_subscribed = ${webhookSubscribed} WHERE id = ${connectionId}::uuid
  `);

  return {
    connectionId,
    igUserId,
    username: account?.username ?? null,
    webhookSubscribed,
    returnTo: payload.r ?? null,
  };
}

/** Re-fetch the profile so the platform card shows fresh counts. Ports `refreshProfile`. */
export async function refreshConnectionProfile(userId: number): Promise<boolean> {
  const rows = await db.execute<{
    [key: string]: unknown;
    id: string;
    ig_user_id: string;
  }>(sql`
    SELECT id, ig_user_id FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED' AND access_token IS NOT NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return false;

  const { validIgAccessToken } = await import("@/domains/platform/ensure-token");
  const token = await validIgAccessToken(String(row.id));
  const { fetchProfile } = await import("./graph-client");
  const profile = await fetchProfile(String(row.ig_user_id), token);
  if (!profile) return false;

  await db.execute(sql`
    UPDATE ig_automation_connections
    SET username = COALESCE(${profile.username}, username),
        account_avatar_url = COALESCE(${profile.profilePictureUrl}, account_avatar_url),
        followers_count = ${profile.followersCount ?? null},
        media_count = ${profile.mediaCount ?? null},
        last_refreshed_at = now(),
        updated_at = now()
    WHERE id = ${String(row.id)}::uuid
  `);
  return true;
}
