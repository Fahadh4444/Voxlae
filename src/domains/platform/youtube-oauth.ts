import { createOAuthState, type OAuthStateMode } from "./oauth-state";

/**
 * YouTube OAuth authorization URLs. Ported from `YouTubeOAuthService.buildAuthorizationUrl`
 * and `buildReconnectUrl`.
 *
 * Scopes match `application.yaml` exactly — both read-only. Requesting more during a migration
 * would force every existing user back through a consent screen.
 */

const AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;

export function buildAuthorizationUrl(
  userId: number,
  mode: OAuthStateMode = "connect",
): string {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error(
      "YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_REDIRECT_URI are not configured.",
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    // offline-access: true in application.yaml — we need a refresh token for the sync jobs.
    access_type: "offline",
    state: createOAuthState(userId, mode),
  });

  if (mode === "reconnect") {
    // Reconnect forces a fresh consent so Google returns a new refresh token, and preserves
    // already-granted scopes. Both carried over from buildReconnectUrl.
    params.set("prompt", "consent");
    params.set("include_granted_scopes", "true");
  } else {
    // force-consent is false in application.yaml, so the normal flow uses select_account.
    params.set("prompt", "select_account");
  }

  return `${AUTH_URI}?${params.toString()}`;
}
