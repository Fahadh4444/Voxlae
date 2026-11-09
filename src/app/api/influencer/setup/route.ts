import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { completeInfluencerSetup } from "@/domains/identity/influencer-setup";
import { RoleNotAssignedError, UserNotFoundError } from "@/domains/identity/roles";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/**
 * POST /api/influencer/setup — takes over from `InfluencerSetupController.completeSetup`.
 *
 * `requireAuth` rather than `requireRole("INFLUENCER")`: the role is INCOMPLETE at this point, which
 * is exactly the state this endpoint exists to resolve. The domain still verifies the role is held.
 *
 * `experienceLevel` is constrained to 1–3 and `postingFrequency` to non-negative because the columns
 * carry CHECK constraints (`V1__baseline`). Without these the database rejects the insert and the
 * user sees a 500 instead of which field was wrong.
 */
const schema = z.object({
  name: z.string({ error: "Name is required" }).trim().min(1, "Name is required").max(120),
  nicheDomain: z.string({ error: "Pick your niche" }).trim().min(1, "Pick your niche").max(120),
  nicheSubdomain: z.string().max(120).optional().nullable(),
  primaryGoal: z.string().max(60).optional().nullable(),
  experienceLevel: z.number().int().min(1).max(3).optional().nullable(),
  postingFrequency: z.number().int().min(0).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
});

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    await completeInfluencerSetup(userId, data);
    return ok(null, "Setup complete");
  } catch (err) {
    if (err instanceof RoleNotAssignedError) {
      return fail("validation_error", "User does not have the INFLUENCER role", 400);
    }
    if (err instanceof UserNotFoundError) return fail("not_found", err.message, 404);
    return unexpected(err);
  }
}
