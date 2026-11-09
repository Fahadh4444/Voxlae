import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { getChannelForUser } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/channel — takes over from `YouTubeChannelController.getChannel`.
 *
 * Reads the **stored** channel row; it does not call YouTube. `POST /channel/sync` is what refreshes
 * it. Returns `null` data rather than a 404 when nothing is connected, matching the Java.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    const channel = await getChannelForUser(claims.userId);
    return channel ? ok(channel) : ok(null, "No YouTube channel connected");
  } catch (error) {
    return authErrorResponse(error);
  }
}
