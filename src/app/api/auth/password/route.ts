import { z } from "zod";
import { ok } from "@/lib/api-response";
import { parseBody, passwordField } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { setPassword } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * PATCH /api/auth/password — takes over from `AuthController.setPassword`.
 *
 * `currentPassword` is optional in the schema because whether it is *required* depends on state the
 * request cannot be trusted about: an account with no password set does not have one to prove. The
 * domain decides, reading the current hash.
 */
const schema = z.object({
  currentPassword: z.string().optional().nullable(),
  newPassword: passwordField,
});

export async function PATCH(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (err) {
    return authErrorResponse(err);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    await setPassword(userId, data.currentPassword, data.newPassword);
    return ok(null, "Password updated successfully");
  } catch (err) {
    return authErrorResponse(err);
  }
}
