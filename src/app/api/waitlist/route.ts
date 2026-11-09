import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { emailField, parseBody } from "@/lib/validate";
import { reserve } from "@/lib/ratelimit";
import { joinWaitlist, WAITLIST_ROLES } from "@/domains/waitlist";

/**
 * POST /api/waitlist — public, from the landing page.
 *
 * Rate-limited per IP, since it is an unauthenticated write. The answer is identical whether the
 * email was new or already listed, so the form cannot be used to probe who has joined.
 */
const schema = z.object({
  email: emailField,
  role: z.enum(WAITLIST_ROLES),
  source: z.string().trim().max(64).optional().nullable(),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const quota = await reserve("waitlist-ip", ip, 10, 60 * 60 * 1000);
  if (!quota.allowed) {
    return fail("rate_limited", "Too many attempts. Please try again later.", 429);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  await joinWaitlist(data.email, data.role, data.source ?? null);
  return ok({ joined: true }, "You're on the list — we'll email you when your spot opens.");
}
