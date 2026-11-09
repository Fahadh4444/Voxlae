import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { connectedChannelId, getVideo } from "@/domains/platform/youtube-data";

/**
 * GET /api/youtube/videos/{videoId} — takes over from `YouTubeChannelController.getVideo`.
 *
 * The lookup is scoped to the caller's own channel. Without that, any signed-in user could read any
 * stored video row by guessing its id — the Java enforced the same rule, by listing the channel's
 * videos and filtering in memory.
 */
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

  try {
    const { videoId } = await params;
    const channelId = await connectedChannelId(userId);
    if (!channelId) return fail("not_connected", "No YouTube channel connected", 400);
    const video = await getVideo(channelId, videoId);
    if (!video) return fail("not_found", "Video not found", 404);
    return ok(video);
  } catch (error) {
    return unexpected(error);
  }
}
