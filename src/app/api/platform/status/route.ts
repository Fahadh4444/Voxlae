import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { platformStatuses } from "@/domains/platform/sync";

/** GET /api/platform/status — takes over from `PlatformSyncController.getAllPlatformStatus`. */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await platformStatuses(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
