import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { getActiveRole } from "@/domains/identity/roles";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * GET /api/user/roles/active — takes over from `UserController.getActiveRole`.
 *
 * Returns the bare role string (or null) as `data`, matching Spring's `ApiResponse<Role>`. A user
 * with no roles yet is a normal state, not an error, so null is a success.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await getActiveRole(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
