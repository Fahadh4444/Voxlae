import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { parseDateRange } from "@/lib/date-range";
import { getVideoAnalyticsLive, VideoNotFoundError } from "@/domains/platform/youtube-analytics";
import { NoChannelError, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/analytics/video/{videoId}?startDate=&endDate= — takes over from
 * `YouTubeAnalyticsController.getVideoAnalytics`. **Live** from the Analytics API. A video not on the
 * caller's own channel is a 404 — see `getVideoAnalyticsLive` for why that needs an explicit check.
 */
export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }
  const range = parseDateRange(request);
  if (range.error) return range.error;
  try {
    const { videoId } = await params;
    return ok(await getVideoAnalyticsLive(userId, videoId, range.startDate, range.endDate));
  } catch (error) {
    if (error instanceof VideoNotFoundError) return fail("not_found", error.message, 404);
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
