import { renderRoleCard } from "../card";

/**
 * GET /og/default — takes over from `OgImageController.defaultCard`.
 *
 * Served at `/og/default` rather than `/og/default.png`: a `.png` segment in the App Router is a
 * literal path segment, and the extension buys nothing — the `content-type` header is what clients
 * read. Anything still linking the old path should be updated; it was only ever referenced from the
 * SEO metadata this migration replaced.
 */
export const runtime = "nodejs";

export async function GET() {
  return renderRoleCard("GENERIC");
}
