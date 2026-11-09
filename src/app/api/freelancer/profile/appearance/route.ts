import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import {
  NoFreelancerProfileError,
  TEMPLATES,
  updateAppearance,
} from "@/domains/freelancer/profile";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/**
 * PATCH /api/freelancer/profile/appearance — takes over from
 * `FreelancerController.updateAppearance`.
 *
 * Persisting the template server-side rather than in the browser is what makes a shared link render
 * the chosen look on every device, not just the browser that picked it.
 */
const schema = z.object({
  profileTemplate: z.enum(TEMPLATES).optional().nullable(),
  coverImageUrl: z.string().max(1024).optional().nullable(),
  coverHiddenOn: z.array(z.string().max(40)).optional().nullable(),
});

export async function PATCH(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await updateAppearance(userId, data));
  } catch (err) {
    if (err instanceof NoFreelancerProfileError) {
      return fail("validation_error", err.message, 400);
    }
    return unexpected(err);
  }
}
