import { requireAuth, toAuthErrorResponse } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { ROLES, type Role } from "@/domains/identity/jwt";
import {
  RoleNotAssignedError,
  switchActiveRole,
  UserNotFoundError,
} from "@/domains/identity/roles";
import { InvalidRefreshTokenError } from "@/domains/identity/refresh-token";
import { readRefreshCookie, setRefreshCookie } from "@/lib/refresh-cookie";

/**
 * POST /api/user/roles/switch — takes over from `UserController.switchRole`, **with Security #2
 * fixed**: the response now carries a fresh access token and a rotated refresh token.
 *
 * **No frontend change is needed for the refresh token.** The rotated token is read from, and
 * written back to, the HttpOnly `refreshToken` cookie — which works now only because one Next
 * deployment serves the browser app and the API from the same origin. The body may still carry it
 * for a client that prefers to pass it explicitly.
 *
 * ⚠️ **The frontend must store the new `accessToken`.** Spring returned only `{success, message,
 * activeRole, previousRole}`, so a client that ignores the new field keeps using its old access
 * token and continues acting as the previous role until it expires — exactly the bug this closes.
 *
 * `requireAuth`, not `requireRole`: switching roles is precisely the thing a user does when their
 * current role is wrong, so gating it on a particular role would be circular.
 */
export async function POST(request: Request) {
  try {
    const claims = await requireAuth(request);
    const body = (await request.json().catch(() => ({}))) as {
      role?: unknown;
      refreshToken?: unknown;
    };

    if (typeof body.role !== "string" || !(ROLES as readonly string[]).includes(body.role)) {
      return fail("invalid_request", `role must be one of: ${ROLES.join(", ")}`, 400);
    }
    // Cookie first: that is where the browser app's token actually lives. The body is a fallback
    // for non-browser callers.
    const current =
      readRefreshCookie(request) ??
      (typeof body.refreshToken === "string" && body.refreshToken ? body.refreshToken : null);
    if (!current) {
      return fail(
        "invalid_request",
        "No refresh token found — it is rotated along with the role change.",
        400,
      );
    }

    const result = await switchActiveRole(claims.userId, body.role as Role, current);
    // The cookie has to be rewritten, or the browser keeps sending the token that was just revoked
    // and the next /auth/refresh signs the user out.
    return setRefreshCookie(ok(result), result.refreshToken);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    if (error instanceof RoleNotAssignedError) return fail("role_not_assigned", error.message, 403);
    if (error instanceof InvalidRefreshTokenError) return fail("invalid_refresh_token", error.message, 401);
    if (error instanceof UserNotFoundError) return fail("not_found", error.message, 404);
    throw error;
  }
}
