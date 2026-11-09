import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { encryptToken } from "@/domains/platform/token-crypto";
import {
  InvalidOAuthStateError,
  verifyOAuthState,
} from "@/domains/platform/oauth-state";
import { YOUTUBE_SCOPES } from "@/domains/platform/youtube-oauth";

/**
 * GET /oauth/youtube/callback — takes over from `YouTubeAuthController.handleYouTubeCallback`.
 *
 * ⚠️ Security fix, not a like-for-like port. The Java callback is unauthenticated and recovers the
 * user with `Long.parseLong(state.split("-")[0])` — unsigned, unverified. Its CSRF check is
 * circular: the controller derives `user` *from the state*, then `exchangeCodeForTokens` verifies
 * the state against that same derived user, so the comparison is always true. Here the state's
 * HMAC is verified before anything else, so a forged state cannot name an arbitrary user.
 *
 * Redirect target also corrected: Spring sends users to `/home?youtube=connected`, and `/home`
 * does not exist — it falls through the catch-all to `/`, so the success and error banners never
 * render. `/influencer/platforms` is the page that actually reads `?youtube=` and `?reason=`.
 */

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const CHANNEL_URI =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

function redirect(path: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL(path, base), { status: 302 });
}

const SUCCESS = "/influencer/platforms?youtube=connected";
const failure = (reason: string) =>
  `/influencer/platforms?youtube=error&reason=${encodeURIComponent(reason)}`;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  // User declined consent, or Google reported a problem.
  if (error) return redirect(failure(error));
  if (!code || !state) return redirect(failure("missing_params"));

  let userId: number;
  try {
    userId = verifyOAuthState(state).u;
  } catch (e) {
    // A bad state is the attack case, not a user error — do not fall back to trusting it.
    return redirect(
      failure(e instanceof InvalidOAuthStateError ? "invalid_state" : "state_error"),
    );
  }

  try {
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return redirect(failure("oauth_not_configured"));
    }

    // --- Network calls, deliberately outside any transaction ---
    const tokenRes = await fetch(TOKEN_URI, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenRes.ok) return redirect(failure("token_exchange_failed"));

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      scope?: string;
    };

    const channelRes = await fetch(CHANNEL_URI, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!channelRes.ok) return redirect(failure("channel_fetch_failed"));

    const channelBody = (await channelRes.json()) as {
      items?: {
        id: string;
        snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
      }[];
    };
    const channel = channelBody.items?.[0];
    if (!channel?.id) return redirect(failure("no_channel"));

    // --- Ownership rules, carried over from persistYouTubeConnection ---
    const existing = await db.execute<{ user_id: number }>(sql`
      SELECT ca.user_id FROM connected_accounts ca
      JOIN platforms p ON p.platform_id = ca.platform_id
      WHERE p.platform_name = 'YOUTUBE' AND ca.external_account_id = ${channel.id}
      LIMIT 1
    `);
    const owner = existing[0]?.user_id;
    if (owner != null && Number(owner) !== userId) {
      return redirect(failure("channel_already_connected"));
    }

    if (owner == null) {
      // One YouTube channel per user: a *different* channel while one is already live is
      // rejected rather than silently creating a second connection.
      const other = await db.execute<{ n: string }>(sql`
        SELECT count(*) AS n FROM connected_accounts ca
        JOIN platforms p ON p.platform_id = ca.platform_id
        WHERE p.platform_name = 'YOUTUBE' AND ca.user_id = ${userId}
          AND ca.revoked = false
      `);
      if (Number(other[0]?.n ?? 0) > 0) {
        return redirect(failure("another_channel_connected"));
      }
    }

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const encryptedRefresh = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;
    const scopes = tokens.scope ?? YOUTUBE_SCOPES.join(" ");
    const title = channel.snippet?.title ?? null;
    const avatar = channel.snippet?.thumbnails?.default?.url ?? null;

    // Upsert. COALESCE on refresh_token because Google omits it when re-consenting without
    // prompt=consent, and overwriting with null would destroy the only recoverable credential.
    await db.execute(sql`
      -- id and connected_at are supplied explicitly. Both are NOT NULL with no default in the
      -- live schema (Hibernate generated them in Java), so omitting either works against a database
      -- built from the migrations and fails in production. See docs/SCHEMA-DRIFT.md.
      INSERT INTO connected_accounts
        (id, user_id, platform_id, external_account_id, account_name, account_avatar_url,
         access_token, refresh_token, token_expiry, scopes, revoked, connection_status, connected_at)
      SELECT gen_random_uuid(), ${userId}, p.platform_id, ${channel.id}, ${title}, ${avatar},
             ${tokens.access_token}, ${encryptedRefresh}, ${expiry}, ${scopes}, false, 'CONNECTED',
             now()
      FROM platforms p WHERE p.platform_name = 'YOUTUBE'
      ON CONFLICT (platform_id, external_account_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            account_name = EXCLUDED.account_name,
            account_avatar_url = EXCLUDED.account_avatar_url,
            access_token = EXCLUDED.access_token,
            refresh_token = COALESCE(EXCLUDED.refresh_token, connected_accounts.refresh_token),
            token_expiry = EXCLUDED.token_expiry,
            scopes = EXCLUDED.scopes,
            revoked = false,
            connection_status = 'CONNECTED'
    `);

    return redirect(SUCCESS);
  } catch {
    return redirect(failure("connection_failed"));
  }
}
