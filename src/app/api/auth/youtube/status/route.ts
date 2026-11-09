import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { getConnection } from "@/domains/platform/connections";

/**
 * GET /api/auth/youtube/status — takes over from `YouTubeAuthController.getYouTubeStatus`.
 *
 * Returns `null` data with a message when nothing is connected — not a 404. The frontend's
 * `getYouTubeStatus()` is typed `ConnectedAccountDTO | null` and treats a null as "not connected",
 * so a 404 here would surface as an error toast instead of the connect button.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    const connection = await getConnection(claims.userId, "YOUTUBE");
    return connection
      ? ok(connection)
      : ok(null, "No YouTube account connected");
  } catch (error) {
    return authErrorResponse(error);
  }
}
