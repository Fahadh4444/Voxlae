import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { ingestVideoAnalytics } from "@/domains/platform/youtube-analytics";
import { NoChannelError, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * POST /api/youtube/analytics/video/{videoId}/ingest — takes over from
 * `YouTubeAnalyticsController.ingestVideoAnalytics`.
 *
 * Pulls the daily report from the YouTube **Analytics** API and stores it. Idempotent: re-ingesting a
 * window writes only the days not already present.
 *
 * `startDate`/`endDate` are optional (`YYYY-MM-DD`); the default window is the last 30 days ending
 * yesterday — yesterday because YouTube's same-day figures are incomplete and would be stored as if final.
 */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const query = new URL(request.url).searchParams;
  const startDate = query.get("startDate") ?? undefined;
  const endDate = query.get("endDate") ?? undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !iso.test(startDate)) || (endDate && !iso.test(endDate))) {
    return fail("validation_error", "startDate and endDate must be YYYY-MM-DD", 400);
  }

  try {
    const { videoId } = await params;
    const result = await ingestVideoAnalytics(userId, videoId, startDate, endDate);
    // `count` + `message` match the UI's SyncResult type (Spring's IngestResult).
    return ok({ count: result.ingested, message: "Video analytics ingested successfully", ...result });
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
