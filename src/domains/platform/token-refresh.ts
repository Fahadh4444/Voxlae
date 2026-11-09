import { sql } from "drizzle-orm";
import { db } from "@/db";
import { decryptToken, encryptToken } from "./token-crypto";

/**
 * YouTube/Google OAuth token refresh. Ported from `YouTubeOAuthService.refreshAccessToken`.
 *
 * Structure carried over deliberately, including the bit that looks like an implementation
 * detail: the Java version splits the network call and the database write so the HTTP round-trip
 * never happens inside a transaction. Holding a transaction open across a call to Google means a
 * slow or hanging response pins a database connection — which matters far more on serverless,
 * where the connection budget is small and shared.
 */

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

/** Unbounded, a slow refresh hangs every request that needs this token. */
const REFRESH_TIMEOUT_MS = 15_000;

export class OAuthRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthRefreshError";
  }
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  /** Google only returns this when it rotates the refresh token. */
  refresh_token?: string;
}

/**
 * Refresh one connection's access token.
 *
 * On failure the account is marked TOKEN_EXPIRED and its access token cleared, but `revoked`
 * stays false — the user can still reconnect, and flipping revoked would hide the account from
 * the UI that prompts them to.
 */
export async function refreshYouTubeToken(accountId: string): Promise<{
  refreshed: boolean;
  rotatedRefreshToken: boolean;
  expiresAt: string;
}> {
  const rows = await db.execute<{ refresh_token: string | null }>(sql`
    SELECT refresh_token FROM connected_accounts WHERE id = ${accountId}::uuid
  `);
  const stored = rows[0]?.refresh_token;
  if (!stored) {
    throw new OAuthRefreshError("No refresh token available for account");
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OAuthRefreshError(
      "YOUTUBE_OAUTH_CLIENT_ID / _SECRET are not configured.",
    );
  }

  let refreshToken: string | null;
  try {
    refreshToken = decryptToken(stored);
  } catch {
    // Corrupt ciphertext, or a key rotation that left old rows unreadable. Either way the
    // credential is gone; mark for reconnection rather than leaving the account looking healthy.
    await markTokenExpired(accountId);
    throw new OAuthRefreshError(
      "Stored refresh token could not be decrypted. Please reconnect your YouTube account.",
    );
  }
  if (!refreshToken) {
    await markTokenExpired(accountId);
    throw new OAuthRefreshError("Stored refresh token could not be decrypted.");
  }

  /**
   * Only Google *rejecting* the grant (4xx — typically `invalid_grant`: revoked, or the refresh token
   * expired) marks the account expired. A timeout, network error or 5xx says nothing about the grant,
   * so it leaves the account alone; clearing the access token on a blip would force a reconnect for
   * no reason.
   */
  let response: Response;
  try {
    // Network call, deliberately outside any transaction.
    response = await fetch(GOOGLE_TOKEN_URI, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OAuthRefreshError(
      `Google token refresh unavailable, will retry: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (response.status >= 500 || response.status === 429) {
    throw new OAuthRefreshError(`Google token refresh unavailable (HTTP ${response.status}), will retry`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    await markTokenExpired(accountId);
    throw new OAuthRefreshError(
      `Failed to refresh access token. Please reconnect your YouTube account. (Google returned ${
        response.status
      }: ${body.slice(0, 200)})`,
    );
  }
  const payload = (await response.json()) as GoogleTokenResponse;

  const expiresAt = new Date(Date.now() + payload.expires_in * 1000);
  // Refresh-token rotation: only overwrite when Google actually sent a new one. Writing null
  // here would destroy the only credential that can recover the connection.
  const rotated = Boolean(payload.refresh_token);
  const newEncrypted = rotated ? encryptToken(payload.refresh_token!) : null;

  await db.execute(sql`
    UPDATE connected_accounts
    SET access_token = ${payload.access_token},
        token_expiry = ${expiresAt.toISOString()},
        connection_status = 'CONNECTED',
        refresh_token = COALESCE(${newEncrypted}, refresh_token)
    WHERE id = ${accountId}::uuid
  `);

  return {
    refreshed: true,
    rotatedRefreshToken: rotated,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Mirrors `ConnectedAccount.markTokenExpired()`: clear the access token, keep revoked false. */
async function markTokenExpired(accountId: string): Promise<void> {
  await db.execute(sql`
    UPDATE connected_accounts
    SET connection_status = 'TOKEN_EXPIRED', access_token = NULL
    WHERE id = ${accountId}::uuid
  `);
}
