import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { listConnections } from "@/domains/platform/connections";

/**
 * GET /api/auth/connections — takes over from `YouTubeAuthController.getAllConnections`.
 *
 * `requireAuth`, not `requireRole`: the account page shows connections regardless of which role the
 * user is currently acting as.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await listConnections(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
