import { z } from "zod";
import { ok } from "@/lib/api-response";
import { emailField, parseBody, passwordField } from "@/lib/validate";
import { signupWithEmail } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * POST /api/auth/signup — takes over from `AuthController.emailSignup`.
 *
 * Returns no tokens: the account exists but is unverified until the emailed code is entered at
 * `/api/auth/email/verify-otp`.
 */
const schema = z.object({
  email: emailField,
  password: passwordField,
  name: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await signupWithEmail(data.email, data.password, data.name));
  } catch (err) {
    return authErrorResponse(err);
  }
}
