import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import {
  NoChannelError,
  syncChannelData,
  YouTubeApiError,
} from "@/domains/platform/youtube-data";

/** POST /api/youtube/channel/sync — takes over from `YouTubeChannelController.syncChannel`. */
export const maxDuration = 60;

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }
  try {
    return ok(await syncChannelData(userId), "Channel data synced successfully");
  } catch (error) {
    if (error instanceof NoChannelError) return fail("not_connected", error.message, 400);
    if (error instanceof YouTubeApiError) return fail("youtube_error", error.message, 400);
    return unexpected(error);
  }
}
