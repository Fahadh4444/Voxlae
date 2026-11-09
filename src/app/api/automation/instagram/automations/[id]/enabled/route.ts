import { requireRole, toAuthErrorResponse } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { setAutomationEnabled } from "@/domains/automation/crud";

/**
 * PATCH .../{id}/enabled — the on/off toggle. Ported ahead of full create/update because it is
 * the control a creator reaches for when an automation misbehaves, so it should be the least
 * likely thing to be unavailable.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") {
      return fail("invalid_request", "Body must be {\"enabled\": true|false}", 400);
    }
    const updated = await setAutomationEnabled(claims.userId, id, body.enabled);
    if (!updated) return fail("not_found", "Automation not found", 404);
    return ok(updated);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
