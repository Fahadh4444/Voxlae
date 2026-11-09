import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { emailField, parseBody } from "@/lib/validate";
import { setRefreshCookie } from "@/lib/refresh-cookie";
import { loginWithEmail } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";
import { reserve } from "@/lib/ratelimit";

/**
 * POST /api/auth/login — takes over from `AuthController.emailLogin`.
 *
 * The refresh token goes out **both** in the body and as the HttpOnly cookie, as Spring did. The
 * cookie is what `/api/auth/refresh` reads; the body copy is what the existing frontend stores.
 * Dropping either breaks one of the two paths.
 *
 * Password length is deliberately *not* constrained here. `@Size(min = 8)` on the login DTO would
 * reject a correct legacy password shorter than 8 characters with a validation error instead of
 * signing the user in — the rule belongs on signup, where it is about what may be created.
 *
 * **Attempts are rate-limited**, which the Java never did: without a cap, any known address —
 * including an admin's — can have its password guessed indefinitely. Two limits, both counting every
 * attempt: per email (stops guessing one account from many IPs) and per IP (stops one source from
 * spraying many accounts). The per-email cap means someone *can* temporarily block password sign-in
 * for an address by spamming it; Google sign-in is unaffected, and the window is 15 minutes.
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_EMAIL = 10;
const PER_IP = 30;
const schema = z.object({
  email: emailField,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [byEmail, byIp] = await Promise.all([
    reserve("login-email", data.email.trim().toLowerCase(), PER_EMAIL, WINDOW_MS),
    reserve("login-ip", ip, PER_IP, WINDOW_MS),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return fail("rate_limited", "Too many sign-in attempts. Please wait 15 minutes and try again.", 429);
  }

  try {
    const auth = await loginWithEmail(data.email, data.password);
    return setRefreshCookie(ok(auth), auth.refreshToken);
  } catch (err) {
    return authErrorResponse(err);
  }
}
