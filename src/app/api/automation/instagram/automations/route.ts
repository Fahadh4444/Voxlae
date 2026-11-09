import { requireRole, toAuthErrorResponse } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import {
  createAutomation,
  listAutomations,
  NoConnectionError,
} from "@/domains/automation/crud";
import { ValidationError } from "@/domains/automation/validation";

/**
 * GET /api/automation/instagram/automations — takes over the list half of `AutomationController`.
 *
 * POST creates one. Validation errors carry the creator-facing message straight through — these
 * strings are what a person reads when their form is rejected, so they are reproduced verbatim
 * rather than rewritten.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    return ok(await listAutomations(claims.userId));
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail("invalid_request", "Request body must be a JSON object", 400);
    }
    return ok(await createAutomation(claims.userId, body));
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    // Both are user-fixable input problems, not server faults.
    if (error instanceof ValidationError) return fail("invalid_request", error.message, 400);
    if (error instanceof NoConnectionError) return fail("not_connected", error.message, 400);
    throw error;
  }
}
