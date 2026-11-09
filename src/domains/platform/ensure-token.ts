import { sql } from "drizzle-orm";
import { db } from "@/db";
import { refreshYouTubeToken } from "./token-refresh";
import { decryptToken, encryptToken } from "./token-crypto";

/**
 * Lazy token refresh — the replacement for `TokenHealthScheduler` / the `token-health` cron.
 *
 * The cron walked every connection every four hours. That is only necessary if nothing else ever
 * looks at the token, and two things do: a request that actually uses the connection, and the user
 * opening the app. Refreshing at those moments covers the same ground with no scheduled job.
 *
 * **Instagram lives in a different table than the cron thought.** `TokenHealthScheduler` refreshed
 * `connected_accounts` rows for both platforms, but V40 unified Instagram onto
 * `ig_automation_connections` and left the old `connected_accounts` Instagram rows inert — its own
 * migration note says "nothing reads them". So the cron's Instagram half has been refreshing dead
 * rows, and the live automation tokens have had no scheduled refresh at all. In practice they
 * survive because `InstagramLoginOAuthService.getValidAccessToken` refreshes on use, with a 1-day
 * buffer. This module targets the real table and widens that buffer to 7 days, so coverage goes from
 * "used within a day of expiry" to "opened the app within a week of it" — strictly more than either
 * the cron or the Java achieved.
 *
 * What is still not covered, precisely: a creator who never opens the app and whose account is never
 * otherwise touched for ~60 days. Instagram long-lived tokens cannot be refreshed once expired —
 * there is no separate refresh token to present — so that connection lapses and needs full
 * re-authorisation. The trade is deliberate: a dormant account has no automations worth running, and
 * `status` flips to `TOKEN_EXPIRED`, so the UI prompts them to reconnect when they return.
 */

/** Instagram's threshold, from `INSTAGRAM_REFRESH_THRESHOLD_DAYS`. */
const IG_REFRESH_WINDOW_DAYS = 7;

/**
 * YouTube access tokens last an hour. Refreshing a minute early rather than on expiry avoids the
 * case where a token passes expiry mid-request, after this function declared it fine.
 */
const YT_REFRESH_SKEW_SECONDS = 60;

const IG_REFRESH_URI = "https://graph.instagram.com/refresh_access_token";
const IG_DEFAULT_TTL_SECONDS = 5_184_000; // 60 days, Meta's default when `expires_in` is omitted

/** Unbounded, a slow refresh hangs every request that needs this token. */
const REFRESH_TIMEOUT_MS = 15_000;

export class IgTokenRefreshError extends Error {
  /**
   * True when the refresh failed for a reason that says nothing about the token — a timeout, a
   * network error, a 5xx. The connection is left CONNECTED and the current token stays usable.
   */
  readonly transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.name = "IgTokenRefreshError";
    this.transient = transient;
  }
}

/**
 * Refresh one Instagram automation connection's long-lived token. Ports
 * `InstagramLoginOAuthService.refreshAccessToken`.
 *
 * Instagram has no separate refresh token: the long-lived token refreshes *itself*, presented to
 * `/refresh_access_token`. An already-expired token therefore cannot be refreshed at all, which is
 * why the expired case marks for reconnection rather than retrying — a retry has nothing to send.
 */
export async function refreshIgAutomationToken(connectionId: string): Promise<string> {
  const rows = await db.execute<{
    [key: string]: unknown;
    access_token: string | null;
    token_expiry: string | null;
  }>(sql`
    SELECT access_token, token_expiry
    FROM ig_automation_connections WHERE id = ${connectionId}::uuid
  `);
  const row = rows[0];
  if (!row?.access_token) {
    await markIgExpired(connectionId);
    throw new IgTokenRefreshError("No access token for this connection");
  }

  if (row.token_expiry && new Date(String(row.token_expiry).replace(" ", "T")) <= new Date()) {
    await markIgExpired(connectionId);
    throw new IgTokenRefreshError(
      "Instagram token already expired and cannot be refreshed. Please reconnect.",
    );
  }

  let current: string | null;
  try {
    current = decryptToken(row.access_token);
  } catch {
    current = null;
  }
  if (!current) {
    await markIgExpired(connectionId);
    throw new IgTokenRefreshError("Stored Instagram token could not be decrypted. Please reconnect.");
  }

  /**
   * Only Meta *rejecting* the token marks the connection expired. A timeout, network error or 5xx
   * says nothing about the token — which, inside the 7-day window, is still valid — so those leave
   * the connection CONNECTED. Treating them alike (as this once did) meant one slow response from
   * Instagram silently disconnected a creator and stopped their automations.
   */
  let response: Response;
  let body: { access_token?: string; expires_in?: number; error?: { message?: string } };
  try {
    const url = `${IG_REFRESH_URI}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`;
    response = await fetch(url, { signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS) });
    body = (await response.json().catch(() => ({}))) as typeof body;
  } catch (error) {
    throw new IgTokenRefreshError(
      `Instagram token refresh unavailable, will retry: ${
        error instanceof Error ? error.message : String(error)
      }`,
      true,
    );
  }
  if (response.status >= 500 || response.status === 429) {
    throw new IgTokenRefreshError(
      `Instagram token refresh unavailable (HTTP ${response.status}), will retry`,
      true,
    );
  }
  if (!response.ok || body.error || !body.access_token) {
    await markIgExpired(connectionId);
    throw new IgTokenRefreshError(
      `Failed to refresh Instagram token. Please reconnect. (${
        body.error?.message ?? `HTTP ${response.status}`
      })`,
    );
  }
  const payload = { access_token: body.access_token, expires_in: body.expires_in };

  const expiresAt = new Date(
    Date.now() + (payload.expires_in ?? IG_DEFAULT_TTL_SECONDS) * 1000,
  );
  await db.execute(sql`
    UPDATE ig_automation_connections
    SET access_token = ${encryptToken(payload.access_token)},
        token_expiry = ${expiresAt.toISOString()},
        last_refreshed_at = now(),
        status = 'CONNECTED',
        updated_at = now()
    WHERE id = ${connectionId}::uuid
  `);
  return payload.access_token;
}

/**
 * Mark for reconnection without revoking.
 *
 * `status = TOKEN_EXPIRED` rather than `DISCONNECTED` on purpose: the UI shows expired connections
 * with a reconnect prompt, while a disconnected one disappears. Hiding it would leave the user with
 * automations that silently stopped and no visible reason.
 */
async function markIgExpired(connectionId: string): Promise<void> {
  await db.execute(sql`
    UPDATE ig_automation_connections
    SET status = 'TOKEN_EXPIRED', updated_at = now()
    WHERE id = ${connectionId}::uuid
  `);
}

/**
 * The decrypted token for an Instagram automation connection, refreshing first if it is inside the
 * expiry buffer. Ports `getValidAccessToken`. Every Graph API call should go through this.
 */
export async function validIgAccessToken(connectionId: string): Promise<string> {
  const rows = await db.execute<{
    [key: string]: unknown;
    access_token: string | null;
    due: boolean;
    still_valid: boolean;
  }>(sql`
    SELECT access_token,
           (token_expiry IS NULL
            OR token_expiry <= now() + interval '${sql.raw(String(IG_REFRESH_WINDOW_DAYS))} days')
             AS due,
           (token_expiry IS NOT NULL AND token_expiry > now()) AS still_valid
    FROM ig_automation_connections WHERE id = ${connectionId}::uuid
  `);
  const row = rows[0];
  if (!row?.access_token) {
    throw new IgTokenRefreshError("No access token for this connection");
  }
  if (row.due) {
    try {
      return await refreshIgAutomationToken(connectionId);
    } catch (error) {
      // Refreshing early is a precaution, not a requirement: if Instagram is merely unreachable and
      // the current token has not expired, use it and try again next time.
      if (!(error instanceof IgTokenRefreshError && error.transient && row.still_valid)) throw error;
      console.warn(`[ensure-token] ${error.message}; using the current token`);
    }
  }

  const decrypted = decryptToken(row.access_token);
  if (!decrypted) {
    throw new IgTokenRefreshError("Stored Instagram token could not be decrypted. Please reconnect.");
  }
  return decrypted;
}

export interface EnsureResult {
  checked: number;
  refreshed: number;
  failed: number;
}

/**
 * Refresh whatever of this user's tokens are near expiry, across both platforms. Never throws.
 *
 * Swallowing failures is correct for every caller: this runs alongside something the user asked for
 * (loading their session, opening a dashboard), and a token that could not be refreshed has already
 * been recorded as expired. Letting it propagate would turn a stale Instagram token into a failed
 * sign-in.
 */
export async function ensureFreshTokens(userId: number): Promise<EnsureResult> {
  const result: EnsureResult = { checked: 0, refreshed: 0, failed: 0 };

  try {
    const youtube = await db.execute<{ [key: string]: unknown; id: string }>(sql`
      SELECT ca.id
      FROM connected_accounts ca
      JOIN platforms p ON p.platform_id = ca.platform_id
      WHERE ca.user_id = ${userId}
        AND ca.revoked = false
        AND p.platform_name = 'YOUTUBE'
        AND ca.refresh_token IS NOT NULL
        AND (ca.token_expiry IS NULL
             OR ca.token_expiry <= now() + interval '${sql.raw(String(YT_REFRESH_SKEW_SECONDS))} seconds')
    `);
    result.checked += youtube.length;
    for (const row of youtube) {
      try {
        await refreshYouTubeToken(String(row.id));
        result.refreshed++;
      } catch (error) {
        result.failed++;
        console.warn(`[ensure-token] YouTube ${row.id}: ${describe(error)}`);
      }
    }
  } catch (error) {
    console.error("[ensure-token] YouTube enumeration failed:", error);
  }

  try {
    const instagram = await db.execute<{ [key: string]: unknown; id: string }>(sql`
      SELECT id FROM ig_automation_connections
      WHERE user_id = ${userId}
        AND status IN ('CONNECTED', 'TOKEN_EXPIRED')
        AND access_token IS NOT NULL
        AND (token_expiry IS NULL
             OR token_expiry <= now() + interval '${sql.raw(String(IG_REFRESH_WINDOW_DAYS))} days')
        -- An expiry already in the past is unrecoverable; attempting it would only re-log the same
        -- failure on every session boot.
        AND (token_expiry IS NULL OR token_expiry > now())
    `);
    result.checked += instagram.length;
    for (const row of instagram) {
      try {
        await refreshIgAutomationToken(String(row.id));
        result.refreshed++;
      } catch (error) {
        result.failed++;
        console.warn(`[ensure-token] Instagram ${row.id}: ${describe(error)}`);
      }
    }
  } catch (error) {
    console.error("[ensure-token] Instagram enumeration failed:", error);
  }

  return result;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Refresh one YouTube connection if it is near expiry, then report whether its token is usable.
 *
 * For callers about to make a Data or Analytics API call. `false` means the connection needs
 * re-authorising — firing a request with a dead token just produces a less informative error.
 */
export async function ensureFreshToken(accountId: string): Promise<boolean> {
  const rows = await db.execute<{
    [key: string]: unknown;
    revoked: boolean;
    due: boolean;
    has_refresh: boolean;
  }>(sql`
    SELECT ca.revoked,
           ca.refresh_token IS NOT NULL AS has_refresh,
           (ca.token_expiry IS NULL
            OR ca.token_expiry <= now() + interval '${sql.raw(String(YT_REFRESH_SKEW_SECONDS))} seconds')
             AS due
    FROM connected_accounts ca WHERE ca.id = ${accountId}::uuid
  `);
  const row = rows[0];
  if (!row || row.revoked) return false;
  if (!row.due) return true;
  // Past expiry with nothing to refresh from: the grant is gone and only re-consent recovers it.
  if (!row.has_refresh) return false;

  try {
    await refreshYouTubeToken(accountId);
    return true;
  } catch (error) {
    console.warn(`[ensure-token] YouTube ${accountId}: ${describe(error)}`);
    return false;
  }
}
