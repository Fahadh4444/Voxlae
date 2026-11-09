import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { ROLES, type Role } from "@/domains/identity/jwt";
import {
  addRole,
  getUserRoles,
  InvalidRoleError,
  UserNotFoundError,
} from "@/domains/identity/roles";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/** GET /api/user/roles — takes over from `UserController.getRoles`. */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await getUserRoles(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}

/**
 * POST /api/user/roles — takes over from `UserController.addRole`.
 *
 * `requireAuth`, not `requireRole`: this is how a user acquires their first role, so gating it on
 * holding one would make the endpoint unreachable exactly when it is needed.
 */
const schema = z.object({
  role: z.enum(ROLES, { error: `role must be one of: ${ROLES.join(", ")}` }),
});

export async function POST(request: Request) {
  let claims;
  try {
    claims = await requireAuth(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await addRole(claims.userId, data.role as Role));
  } catch (err) {
    if (err instanceof InvalidRoleError) return fail("INVALID_ROLE", err.message, 400);
    if (err instanceof UserNotFoundError) return fail("not_found", err.message, 404);
    return unexpected(err);
  }
}
