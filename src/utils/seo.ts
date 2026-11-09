/**
 * SEO helpers — resolve the canonical site origin and build absolute URLs for
 * canonical links and dynamically-generated Open Graph card images.
 *
 * These need to be *absolute* URLs: social crawlers fetch og:image from their own
 * servers, so a relative "/api/og/…" would resolve against the wrong host (or fail).
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL as string | undefined) || '';

/** Site origin without a trailing slash, e.g. "https://voxlae.com". */
export const SITE_URL: string = (
  (process.env.NEXT_PUBLIC_SITE_URL as string | undefined) ||
  // Derive from the API base by stripping a trailing "/api".
  (API_BASE ? API_BASE.replace(/\/api\/?$/, '') : '') ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://voxlae.com')
).replace(/\/$/, '');

/** Absolute API origin, e.g. "https://voxlae.com/api". */
export const API_ORIGIN: string = (API_BASE || `${SITE_URL}/api`).replace(/\/$/, '');

/** The site-wide branded OG card (the landing hero), used on any page without its
 *  own profile card. Served as a static file from the site root. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Turn a site-relative path into an absolute URL against SITE_URL. */
export function absoluteUrl(path: string): string {
  if (!path) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL + (path.startsWith('/') ? path : `/${path}`);
}

/**
 * Absolute URL of the generated OG card for a profile.
 * role: 'f' = freelancer, 'i' = influencer, 'b' = brand.
 */
export function ogImageUrl(role: 'f' | 'i' | 'b', slug: string): string {
  return `${API_ORIGIN}/og/${role}/${encodeURIComponent(slug)}.png`;
}
