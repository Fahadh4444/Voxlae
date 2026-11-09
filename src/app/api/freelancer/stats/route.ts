import { requireAuth, toAuthErrorResponse } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import { getFreelancerStats } from "@/domains/search/freelancer-search";

/** GET /api/freelancer/stats — takes over from `SearchController.freelancerStats`. */
export async function GET(request: Request) {
  try {
    await requireAuth(request);
    return ok(await getFreelancerStats());
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
