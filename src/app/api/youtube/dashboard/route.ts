import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { ALLOWED_RANGES, getYouTubeDashboard } from "@/domains/platform/youtube-dashboard";
import { NoChannelError, YouTubeApiError } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/dashboard?range=7|30|90 — takes over from `YouTubeDashboardController`.
 *
 * **Composed live from the YouTube Analytics API on every request**, unlike the Java, which read
 * stored snapshot tables and fell back to live reports only when they were empty. No ingest step
 * stands between a creator and their own numbers.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const raw = Number(new URL(request.url).searchParams.get("range"));
  const range = (ALLOWED_RANGES as readonly number[]).includes(raw) ? raw : 30;

  try {
    return ok(await getYouTubeDashboard(userId, range));
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 404);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
