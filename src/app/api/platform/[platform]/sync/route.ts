import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { syncOnePlatform } from "@/domains/platform/sync";

/**
 * POST /api/platform/{platform}/sync — takes over from `PlatformSyncController.syncPlatform`.
 *
 * A *failed* sync still returns 200 with the failure described in the body, matching the Java's
 * explicit choice: the frontend renders the reason inline rather than showing a generic error toast.
 * Only "no such connection" is a 400.
 */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const { platform } = await params;
    const result = await syncOnePlatform(userId, platform);
    if (!result) return fail("not_connected", `No ${platform} account connected`, 400);
    return ok(result, result.message);
  } catch (error) {
    return unexpected(error);
  }
}
