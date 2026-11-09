import { ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { isAdminEmail } from "@/domains/identity/access";
import { listAccounts } from "@/domains/waitlist";

/** GET /api/admin/accounts — every existing account and whether it may get in. Admins only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return authErrorResponse(error);
  }
  return ok(await listAccounts(isAdminEmail));
}
