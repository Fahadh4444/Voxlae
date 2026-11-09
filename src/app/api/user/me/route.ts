import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { getMe } from "@/domains/identity/auth-service";
import { updateDisplayName } from "@/domains/identity/roles";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/**
 * GET / PATCH /api/user/me — takes over from `UserController.getMe` / `updateProfile`.
 *
 * Near-duplicate of `/api/auth/me` by design, not accident: both existed in Spring and the frontend
 * calls both. They share `getMe`, so the payloads cannot drift. The one difference is that
 * `/api/auth/me` also runs the session-boot side effects (token refresh, snapshot capture); this one
 * is a plain read, so a profile save does not drag that work along with it.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await getMe(claims.userId, claims.email));
  } catch (error) {
    return authErrorResponse(error);
  }
}

/**
 * The name is the single source of truth for the navbar, the account page **and** the freelancer's
 * public profile, so it is stored on `users` rather than duplicated per role.
 */
const schema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(255),
});

export async function PATCH(request: Request) {
  let claims;
  try {
    claims = await requireAuth(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    const updated = await updateDisplayName(claims.userId, data.name);
    if (!updated) return fail("not_found", "User not found", 404);
    return ok(await getMe(claims.userId, claims.email));
  } catch (err) {
    return unexpected(err);
  }
}
