import { renderRoleCard } from "../../card";

/**
 * GET /og/b/{slug} — takes over from `OgImageController.brandCard`.
 *
 * As with the influencer card, the slug is unused because brand profiles are not public pages. See
 * `og/card.tsx`.
 */
export const runtime = "nodejs";

export async function GET() {
  return renderRoleCard("BRAND");
}
