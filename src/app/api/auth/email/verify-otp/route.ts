import { z } from "zod";
import { ok } from "@/lib/api-response";
import { emailField, otpField, parseBody } from "@/lib/validate";
import { setRefreshCookie } from "@/lib/refresh-cookie";
import { verifyEmailOtp } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/** POST /api/auth/email/verify-otp — takes over from `AuthController.verifyEmailOtp`. */
const schema = z.object({ email: emailField, otp: otpField });

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    const auth = await verifyEmailOtp(data.email, data.otp);
    return setRefreshCookie(ok(auth), auth.refreshToken);
  } catch (err) {
    return authErrorResponse(err);
  }
}
