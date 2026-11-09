import { requireRole, toAuthErrorResponse } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import {
  deleteAutomation,
  getAutomation,
  updateAutomation,
} from "@/domains/automation/crud";
import { ValidationError } from "@/domains/automation/validation";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * A 404 here means "not found **or** not yours" — deliberately indistinguishable, matching
 * `requireOwned`. Returning 403 for someone else's automation would confirm that the id exists,
 * which is an enumeration oracle.
 */
export async function GET(request: Request, { params }: Ctx) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const { id } = await params;
    const automation = await getAutomation(claims.userId, id);
    if (!automation) return fail("not_found", "Automation not found", 404);
    return ok(automation);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const { id } = await params;
    const removed = await deleteAutomation(claims.userId, id);
    if (!removed) return fail("not_found", "Automation not found", 404);
    return ok(null);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return fail("invalid_request", "Request body must be a JSON object", 400);
    }
    const updated = await updateAutomation(claims.userId, id, body);
    if (!updated) return fail("not_found", "Automation not found", 404);
    return ok(updated);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    if (error instanceof ValidationError) return fail("invalid_request", error.message, 400);
    throw error;
  }
}
