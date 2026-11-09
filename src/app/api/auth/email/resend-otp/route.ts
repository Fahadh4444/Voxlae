import { z } from "zod";
import { ok } from "@/lib/api-response";
import { emailField, parseBody } from "@/lib/validate";
import { resendOtp } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/** POST /api/auth/email/resend-otp — takes over from `AuthController.resendOtp`. */
const schema = z.object({ email: emailField });

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await resendOtp(data.email));
  } catch (err) {
    return authErrorResponse(err);
  }
}
