import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { parseBody } from "@/lib/validate";
import { reissueInvite } from "@/domains/waitlist";

/**
 * POST /api/admin/waitlist/{id}/invite — `{ "send": boolean }`. Admins only.
 *
 * A fresh invite link for an approved entry with no account: `send: true` emails it ("Resend
 * invite"), `send: false` only returns it ("Copy link", for sharing by hand). Either way the previous
 * link stops working — only a hash is stored, so an old link can be replaced but never shown again.
 */
const schema = z.object({ send: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("validation_error", "Invalid id.", 400);

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await reissueInvite(id, data.send));
  } catch (err) {
    return authErrorResponse(err);
  }
}
