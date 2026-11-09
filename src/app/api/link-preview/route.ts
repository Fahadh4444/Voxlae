import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { fetchLinkPreview } from "@/domains/link/preview";
import { reserve } from "@/lib/ratelimit";

/**
 * GET /api/link-preview?url=… — takes over from `LinkPreviewController`.
 *
 * **Authenticated, and that is a security control rather than a convention.** This endpoint makes the
 * server fetch a URL of the caller's choosing, so leaving it public would be an unauthenticated,
 * internet-facing SSRF probe. `src/domains/link/preview.ts` documents the network-level guards.
 *
 * Rate-limited per user, which the Java was not: authentication limits *who* can use the endpoint, not
 * how hard. Without a cap, one account can drive the deployment as a scanner or a traffic amplifier
 * against a third party, and both bills land on us.
 */
export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url) return fail("invalid_request", "url is required", 400);

  const quota = await reserve("link-preview", String(userId), 60, 60 * 60 * 1000);
  if (!quota.allowed) {
    return fail(
      "rate_limited",
      "Too many link previews. Try again shortly.",
      429,
    );
  }

  try {
    const preview = await fetchLinkPreview(url);
    if (!preview) {
      return fail("preview_unavailable", "Couldn't read a preview from that link", 404);
    }
    return ok(preview);
  } catch (error) {
    return unexpected(error);
  }
}
