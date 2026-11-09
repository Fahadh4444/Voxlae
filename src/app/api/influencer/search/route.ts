import { requireAuth, toAuthErrorResponse } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import { searchInfluencers } from "@/domains/search/influencer-search";

/**
 * GET /api/influencer/search — takes over from `SearchController.searchInfluencers`.
 *
 * Spring read the caller's id straight off the Authorization header purely to log it; that is
 * dropped rather than reproduced. `requireAuth` already proves the token, and the claims are
 * available if a real need for the id appears.
 */
export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const params = new URL(request.url).searchParams;
    return ok(
      await searchInfluencers(
        params.get("keyword") ?? undefined,
        params.get("niche") ?? undefined,
      ),
    );
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
