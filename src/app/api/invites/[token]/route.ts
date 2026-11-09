import { fail, ok } from "@/lib/api-response";
import { authErrorResponse } from "@/lib/auth-errors";
import { reserve } from "@/lib/ratelimit";
import { lookupInvite } from "@/domains/waitlist";

/**
 * GET /api/invites/{token} — public. The email and role behind a live invite link, so /signup can
 * show "Create your account" with the email locked; otherwise why the link is not live.
 *
 * Tokens are 256-bit, so guessing is not a realistic attack; the per-IP cap just keeps the endpoint
 * from being a free way to hammer the database.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await reserve("invite-lookup-ip", ip, 60, 60 * 60 * 1000)).allowed) {
    return fail("rate_limited", "Too many attempts. Please try again later.", 429);
  }
  try {
    return ok(await lookupInvite((await params).token));
  } catch (error) {
    return authErrorResponse(error);
  }
}
