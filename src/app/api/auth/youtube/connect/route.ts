import { requireRole } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { authErrorResponse } from "@/lib/auth-errors";
import { buildAuthorizationUrl } from "@/domains/platform/youtube-oauth";
import { getConnection } from "@/domains/platform/connections";

/**
 * GET /api/auth/youtube/connect — takes over from `YouTubeAuthController.initiateYouTubeConnect`.
 *
 * ⚠️ This route and `/oauth/youtube/callback` must migrate **together**. They share the `state`
 * format, and the port signs it while Spring's does not — a state minted by one and read by the
 * other will be rejected. An OAuth flow already in flight across a deploy will fail once and
 * succeed on retry.
 */
export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireRole(request, "INFLUENCER")).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const existing = await getConnection(userId, "YOUTUBE");

  // A live connection is refused rather than silently re-authorised. Running the flow again would
  // mint a second grant for a channel already connected, and the partial unique index on
  // (user_id, platform_id) WHERE revoked = false rejects the insert anyway — as a 500 rather than
  // this message.
  if (existing?.isActive) {
    return fail(
      "already_connected",
      "YouTube account is already connected. Disconnect first to reconnect.",
      400,
    );
  }

  /**
   * An expired or errored connection goes down the reconnect path, which forces `prompt=consent`.
   * Without that Google withholds the refresh token on re-authorisation, so the reconnection would
   * appear to succeed and then expire within the hour with nothing to renew it.
   */
  const explicit = new URL(request.url).searchParams.get("mode") === "reconnect";
  const mode = explicit || existing ? "reconnect" : "connect";

  return ok({
    authorizationUrl: buildAuthorizationUrl(userId, mode),
    message:
      mode === "reconnect"
        ? "Redirect user to this URL to reconnect YouTube access"
        : "Redirect user to this URL to authorize YouTube access",
  });
}
