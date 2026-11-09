import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { getActiveRoleStatus } from "@/domains/identity/roles";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * GET /api/user/role-status — takes over from `UserController.getActiveRoleStatus`.
 *
 * The active role plus its INCOMPLETE/ACTIVE status, which is what the UI checks to decide whether
 * to show a feature or send the user back to role setup. Null when there is no active role.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await getActiveRoleStatus(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}
