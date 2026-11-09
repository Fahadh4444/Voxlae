/**
 * `/freelancer/{slug}` → `/f/{slug}`.
 *
 * Back-compat for profile links shared before the short URL existed. The Vite app had
 * `LegacyFreelancerRedirect` for exactly this, and without it those links would 404 after the move.
 *
 * A route handler rather than a `redirects()` rule in `next.config.ts` on purpose: `/freelancer/profile`
 * and `/freelancer/templates` are real pages under the same prefix. Static segments beat a dynamic one
 * here automatically, whereas a config redirect runs before routing and would have to exclude them by
 * hand — and silently break them the day a third page is added.
 *
 * A route handler rather than a page calling `permanentRedirect()`: a page renders inside the root
 * layout, which streams, so the redirect arrives as a 200 with a meta-refresh tag. Crawlers treat that
 * as a soft redirect at best. This returns a real 308, so search engines move their index to `/f/`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return Response.redirect(new URL(`/f/${encodeURIComponent(slug)}`, request.url), 308);
}
