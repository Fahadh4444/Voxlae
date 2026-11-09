import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { connectedChannelId, getVideosForChannel } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/videos?limit=50 — takes over from `YouTubeChannelController.getVideos`.
 *
 * `limit` is capped at 200. The Java accepted any integer and `getVideo` passed `Integer.MAX_VALUE`,
 * which would load every row for a large channel to return one of them.
 */
export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const raw = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 50;

  try {
    const channelId = await connectedChannelId(userId);
    if (!channelId) return fail("not_connected", "No YouTube channel connected", 400);
    return ok(await getVideosForChannel(channelId, limit));
  } catch (error) {
    return unexpected(error);
  }
}
