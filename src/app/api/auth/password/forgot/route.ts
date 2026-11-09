import { z } from "zod";
import { ok } from "@/lib/api-response";
import { emailField, parseBody } from "@/lib/validate";
import { requestPasswordReset } from "@/domains/identity/auth-service";
import { unexpected } from "@/lib/auth-errors";

/**
 * POST /api/auth/password/forgot — takes over from `AuthController.forgotPassword`.
 *
 * The response is identical whether or not the address has an account. That is the point: a
 * different response for a known address turns this endpoint into a way to enumerate who has a
 * Voxlae account. `requestPasswordReset` therefore returns normally in both cases, and nothing here
 * inspects which happened.
 */
const schema = z.object({ email: emailField });

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    const devOtp = await requestPasswordReset(data.email);
    return ok({
      message: "If an account exists for this email, a reset code has been sent.",
      email: data.email,
      requiresEmailVerification: false,
      devOtp,
    });
  } catch (err) {
    return unexpected(err);
  }
}
