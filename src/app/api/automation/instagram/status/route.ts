import { requireRole, toAuthErrorResponse } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import { getConnection } from "@/domains/automation/connection";

/**
 * GET /api/automation/instagram/status.
 *
 * Returns `null` data rather than 404 when nothing is connected — "not connected" is the normal
 * state for most users, not an error, and the automations page branches on it.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    return ok(await getConnection(claims.userId));
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
