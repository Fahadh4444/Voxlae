import { z } from "zod";
import { ok } from "@/lib/api-response";
import { parseBody, passwordField } from "@/lib/validate";
import { setRefreshCookie } from "@/lib/refresh-cookie";
import { signupWithInvite } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";

/**
 * POST /api/auth/signup/invite — create an account from an invite link and sign in.
 *
 * Takes the token, not an email: the address comes from the invite, so a link can only ever create
 * the account it was sent for. Returns tokens like /login (body + refresh cookie).
 */
const schema = z.object({
  token: z.string().trim().min(10, "Invalid invite."),
  name: z.string().trim().max(120).optional().default(""),
  password: passwordField,
});

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    const auth = await signupWithInvite(data.token, data.name, data.password);
    return setRefreshCookie(ok(auth), auth.refreshToken);
  } catch (err) {
    return authErrorResponse(err);
  }
}
