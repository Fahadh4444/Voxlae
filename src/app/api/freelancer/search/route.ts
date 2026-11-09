import { requireAuth, toAuthErrorResponse } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import {
  DEFAULT_LIMIT,
  searchFreelancers,
} from "@/domains/search/freelancer-search";

/**
 * GET /api/freelancer/search — takes over from Spring's `SearchController.searchFreelancers`.
 *
 * The rewrite in next.config.ts is an `afterFiles` rule, so the existence of this file is what
 * moves the endpoint; deleting it hands traffic straight back to Spring.
 *
 * Authenticated, matching `anyRequest().authenticated()` — this endpoint was never in
 * SecurityConfig's permitAll list.
 */
export async function GET(request: Request) {
  try {
    await requireAuth(request);

    const params = new URL(request.url).searchParams;
    // Repeated params (?skills=a&skills=b) match Spring's List<String> binding.
    const list = (name: string) => {
      const values = params.getAll(name).flatMap((v) => v.split(","));
      return values.map((v) => v.trim()).filter(Boolean);
    };
    const text = (name: string) => params.get(name)?.trim() || undefined;
    const maxRateRaw = params.get("maxRate");
    const limitRaw = Number(params.get("limit"));

    const results = await searchFreelancers(
      {
        keyword: text("keyword"),
        skills: list("skills"),
        tools: list("tools"),
        languages: list("languages"),
        location: text("location"),
        availability: text("availability"),
        maxRate:
          maxRateRaw != null && maxRateRaw.trim() !== "" && !Number.isNaN(Number(maxRateRaw))
            ? Number(maxRateRaw)
            : undefined,
        rateCurrency: text("rateCurrency"),
      },
      Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT,
    );

    return ok(results);
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
