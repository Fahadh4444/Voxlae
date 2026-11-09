import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { getConnection } from "@/domains/automation/connection";
import { refreshConnectionProfile } from "@/domains/automation/oauth";
import { IgTokenRefreshError } from "@/domains/platform/ensure-token";

/**
 * POST /api/automation/instagram/refresh — takes over from
 * `InstagramAutomationAuthController.refresh`.
 *
 * Re-reads the profile so the platform card shows current follower and post counts. Also refreshes
 * the cached counts `daily-snapshot.ts` reads, so this doubles as a way to keep follower history
 * flowing for a creator who opens the platforms page but not the dashboard.
 */
export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const refreshed = await refreshConnectionProfile(userId);
    if (!refreshed) return fail("not_connected", "No Instagram account connected", 400);
    return ok(await getConnection(userId));
  } catch (error) {
    if (error instanceof IgTokenRefreshError) {
      return fail("instagram_error", error.message, 400);
    }
    return unexpected(error);
  }
}
