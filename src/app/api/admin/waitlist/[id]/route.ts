import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { parseBody } from "@/lib/validate";
import { approveEntry, revokeEntry } from "@/domains/waitlist";

/**
 * PATCH /api/admin/waitlist/{id} — `{ "status": "APPROVED" | "PENDING" }`. Admins only.
 *
 * APPROVED lets the email in and tells them: an invite link if they have no account, "you're back
 * in" if they do. The response says whether the email went out and carries the invite link, so a
 * failed send is never a dead end. PENDING takes access away at their next token refresh.
 */
const schema = z.object({ status: z.enum(["APPROVED", "PENDING"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("validation_error", "Invalid id.", 400);

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  if (data.status === "APPROVED") {
    const outcome = await approveEntry(id);
    if (!outcome) return fail("not_found", "No waitlist entry with that id.", 404);
    return ok({ id, status: data.status, ...outcome });
  }
  if (!(await revokeEntry(id))) return fail("not_found", "No waitlist entry with that id.", 404);
  return ok({ id, status: data.status });
}
