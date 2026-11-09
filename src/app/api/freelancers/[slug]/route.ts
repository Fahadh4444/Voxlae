import { ok, fail } from "@/lib/api-response";
import { getAuth } from "@/lib/auth";
import { getPublicProfile } from "@/domains/freelancer/profile";
import { unexpected } from "@/lib/auth-errors";

/**
 * GET /api/freelancers/{slug} — takes over from `FreelancerPublicController`.
 *
 * Public, with partial gating. `getAuth` rather than `requireAuth`: an anonymous visitor is the
 * primary audience here — this is the shareable link — so a missing or invalid token downgrades the
 * payload instead of refusing it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const claims = await getAuth(request);
    const profile = await getPublicProfile(slug, claims !== null);
    if (!profile) return fail("not_found", "Freelancer profile not found", 404);
    return ok(profile);
  } catch (error) {
    return unexpected(error);
  }
}
