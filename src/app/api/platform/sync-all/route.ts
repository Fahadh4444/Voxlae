import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { syncAllPlatforms } from "@/domains/platform/sync";

/**
 * POST /api/platform/sync-all — takes over from `PlatformSyncController.syncAllPlatforms`.
 *
 * Always 200, with per-platform outcomes in the body. A platform whose token expired is a state the
 * UI must render (with a reconnect prompt), not an error that should fail the whole request.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }
  try {
    const results = await syncAllPlatforms(userId);
    const allOk = results.every((r) => r.success);
    return ok(results, allOk ? "All platforms synced successfully" : "Some platforms require attention");
  } catch (error) {
    return unexpected(error);
  }
}
