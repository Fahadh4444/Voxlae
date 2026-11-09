import { ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { listWaitlist } from "@/domains/waitlist";

/** GET /api/admin/waitlist — every entry, newest first, with counts. Admins only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }
  return ok(await listWaitlist());
}
