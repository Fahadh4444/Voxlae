import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api-response";
import {
  authenticateWithGoogle,
  type OnboardingColumns,
} from "@/domains/identity/auth-service";
import { InvalidGoogleTokenError } from "@/domains/identity/google-auth";

/**
 * POST /api/auth/google — takes over from `AuthController.googleAuth`.
 *
 * Returns the refresh token **both** in the body and as an HttpOnly cookie, exactly as Spring
 * did. The cookie is what `/api/auth/refresh` reads; the body copy is what the existing frontend
 * stores. Dropping either would break one of the two paths.
 */

const COOKIE_NAME = "refreshToken";

/**
 * Cookie attributes mirror `RefreshCookieFactory`. `SameSite=None` requires `Secure`, and a
 * browser refuses `Secure` over plain HTTP — so local dev must use `Lax`, which is why this is
 * derived from the environment rather than hardcoded.
 */
function refreshCookie(token: string, maxAgeSeconds: number): string {
  const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
  const sameSite = isHttps ? "None" : "Lax";
  const secure = isHttps ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=${sameSite}${secure}; Max-Age=${maxAgeSeconds}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    idToken?: unknown;
    columns?: OnboardingColumns | null;
  } | null;

  if (!body || typeof body.idToken !== "string" || !body.idToken) {
    return fail("invalid_request", "idToken is required", 400);
  }

  try {
    const auth = await authenticateWithGoogle(body.idToken, body.columns ?? null);

    const maxAge = Math.floor(
      Number(process.env.JWT_REFRESH_TOKEN_EXPIRATION_MS ?? 2_592_000_000) / 1000,
    );
    const response = ok(auth);
    response.headers.append("set-cookie", refreshCookie(auth.refreshToken, maxAge));
    return response;
  } catch (error) {
    if (error instanceof InvalidGoogleTokenError) {
      return fail("invalid_google_token", error.message, 401);
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "ERROR", data: null, error: "auth_failed", message },
      { status: 500 },
    );
  }
}
