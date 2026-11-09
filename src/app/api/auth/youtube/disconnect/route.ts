import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { disconnectPlatform } from "@/domains/platform/connections";

/**
 * DELETE /api/auth/youtube/disconnect — takes over from `YouTubeAuthController.disconnectYouTube`.
 *
 * Succeeds even when Google refuses the token revocation; see `disconnectPlatform` for why that
 * ordering matters. The only failure case is having nothing to disconnect.
 */
export async function DELETE(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const result = await disconnectPlatform(userId, "YOUTUBE");
    if (result === "not_connected") {
      return fail("not_connected", "No YouTube account connected", 400);
    }
    return ok(null, "YouTube account disconnected successfully");
  } catch (error) {
    return unexpected(error);
  }
}
