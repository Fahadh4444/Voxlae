import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { NoChannelError, syncVideos, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * POST /api/youtube/videos/sync?maxVideos=N — takes over from `YouTubeChannelController.syncVideos`.
 *
 * Paging the uploads playlist plus a details call per 50 videos; slow enough to need the raised
 * timeout, and capped at 500 so one request cannot exhaust the day's Data API quota.
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const raw = Number(new URL(request.url).searchParams.get("maxVideos"));
  const maxVideos = Number.isFinite(raw) && raw > 0 ? raw : null;

  try {
    return ok(await syncVideos(userId, maxVideos));
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
