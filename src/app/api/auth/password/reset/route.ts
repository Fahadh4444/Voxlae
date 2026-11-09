import { z } from "zod";
import { ok } from "@/lib/api-response";
import { emailField, parseBody, passwordField } from "@/lib/validate";
import { clearRefreshCookie } from "@/lib/refresh-cookie";
import { resetPassword } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * POST /api/auth/password/reset — takes over from `AuthController.resetPassword`.
 *
 * Every session is revoked server-side, and the cookie is cleared here too — otherwise the browser
 * that just reset the password keeps sending a refresh token the server has already invalidated,
 * producing a 401 on the next call that looks like a bug rather than the intended sign-out.
 */
const schema = z.object({
  email: emailField,
  otp: z.string({ error: "Reset code is required" }).trim().min(1, "Reset code is required"),
  newPassword: passwordField,
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    await resetPassword(data.email, data.otp, data.newPassword);
    return clearRefreshCookie(
      ok(null, "Your password has been updated. Please sign in."),
    );
  } catch (err) {
    return authErrorResponse(err);
  }
}
