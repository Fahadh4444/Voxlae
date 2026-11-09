import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { ingestAllVideoAnalytics } from "@/domains/platform/youtube-analytics";
import { NoChannelError, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * POST /api/youtube/analytics/videos/ingest — takes over from
 * `YouTubeAnalyticsController.ingestAllVideoAnalytics`.
 *
 * One Analytics call per video — roughly ten seconds each — so the run is capped at 20 videos to stay
 * inside the function timeout. Videos already covered for the window are skipped, so **calling this
 * repeatedly works through the channel**; `remaining` in the response says how many are left.
 *
 * Individual video failures are counted and reported rather than aborting the run: a deleted or
 * private video would otherwise block every video behind it.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
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
    const result = await ingestAllVideoAnalytics(userId, startDate, endDate);
    // `count` + `message` are what the UI's SyncResult type reads (Spring's IngestResult); the rest
    // is additive detail.
    return ok(
      { count: result.ingested, message: "All video analytics ingested successfully", ...result },
      `Ingested ${result.ingested} day-row(s) across ${result.videos} video(s)` +
        (result.remaining > 0 ? ` — ${result.remaining} video(s) still pending, call again` : ""),
    );
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
