import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { parseDateRange } from "@/lib/date-range";
import { getChannelAnalyticsLive } from "@/domains/platform/youtube-analytics";
import { NoChannelError, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/analytics/channel?startDate=&endDate= — takes over from
 * `YouTubeAnalyticsController.getChannelAnalytics`. **Live** from the Analytics API.
 */
export const maxDuration = 30;

export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }
  const range = parseDateRange(request);
  if (range.error) return range.error;
  try {
    return ok(await getChannelAnalyticsLive(userId, range.startDate, range.endDate));
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
