import { requireRole, toAuthErrorResponse } from "@/lib/auth";
import { fail, ok } from "@/lib/api-response";
import { getAutomationStats } from "@/domains/automation/crud";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const claims = await requireRole(request, "INFLUENCER");
    const { id } = await params;
    const stats = await getAutomationStats(claims.userId, id);
    if (!stats) return fail("not_found", "Automation not found", 404);
    return ok(stats);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
