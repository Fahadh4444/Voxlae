import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { getConnection } from "@/domains/platform/connections";
import { buildAuthorizationUrl } from "@/domains/platform/youtube-oauth";

/**
 * POST /api/auth/youtube/reconnect — takes over from `YouTubeAuthController.reconnectYouTube`.
 *
 * Differs from `/connect` only in requiring an existing connection (however dead) and in forcing
 * `prompt=consent`. The forced consent is the point: Google returns a refresh token **only** on the
 * first authorisation unless consent is re-prompted, so a silent re-auth would hand back an access
 * token with no way to renew it, and the connection would die again within the hour.
 */
export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const existing = await getConnection(userId, "YOUTUBE");
  if (!existing) {
    return fail("no_account", "No YouTube account to reconnect. Use connect instead.", 400);
  }

  return ok({
    authorizationUrl: buildAuthorizationUrl(userId, "reconnect"),
    message: "Redirect user to this URL to reconnect YouTube access",
  });
}
