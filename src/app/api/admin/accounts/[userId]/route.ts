import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { parseBody } from "@/lib/validate";
import { setAccountAccess } from "@/domains/waitlist";

/**
 * PATCH /api/admin/accounts/{userId} — `{ "allow": boolean }`. Admins only.
 *
 * Lets an existing account in without them joining the waitlist first (and emails them "you're back
 * in"), or blocks it again. Blocking takes effect at their next token refresh.
 */
const schema = z.object({ allow: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const userId = Number((await params).userId);
  if (!Number.isInteger(userId) || userId <= 0) return fail("validation_error", "Invalid id.", 400);

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const outcome = await setAccountAccess(userId, data.allow);
  if (!outcome) return fail("not_found", "No account with that id.", 404);
  return ok({ userId, ...outcome });
}
