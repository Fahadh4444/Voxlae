import { renderRoleCard } from "../../card";

/**
 * GET /og/i/{slug} — takes over from `OgImageController.influencerCard`.
 *
 * **The slug is intentionally unused.** `SeoContentService.roleCard` ignored it too: influencer
 * profiles are not public pages, so there is no per-profile content to render. The parameter is kept
 * so that making those pages public is a change in this file and nowhere else.
 */
export const runtime = "nodejs";

export async function GET() {
  return renderRoleCard("INFLUENCER");
}
