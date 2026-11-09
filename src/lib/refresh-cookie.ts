import type { NextResponse } from "next/server";

/**
 * The refresh-token cookie. Ports `RefreshCookieFactory`.
 *
 * The cookie carries the 30-day refresh token that keeps a user signed in; the access token lives
 * 15 minutes and is renewed against it. For that to work the browser has to actually *send* the
 * cookie to `/api/auth/refresh`.
 *
 * Spring needed `SameSite=None` in production, and that requirement is now gone: `None` existed
 * because the browser app and the API were separate origins, so the refresh call was cross-site and
 * a `Lax` cookie would not have been sent — logging users out the moment their access token
 * expired. One Next deployment serves both, so the call is same-origin and `Lax` works. That is
 * strictly the safer setting, since `None` sends the cookie on *any* cross-site request, which is
 * the precondition for CSRF; `Lax` does not.
 *
 * `Secure` still tracks the scheme, because a browser silently discards a `Secure` cookie over
 * plain HTTP and local dev is HTTP.
 */

export const REFRESH_COOKIE = "refreshToken";

const REFRESH_TTL_SECONDS = Math.floor(
  Number(process.env.JWT_REFRESH_TOKEN_EXPIRATION_MS ?? 2_592_000_000) / 1000,
);

function isHttps(): boolean {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return site.startsWith("https://");
}

function serialize(value: string, maxAgeSeconds: number): string {
  const secure = isHttps() ? "; Secure" : "";
  return `${REFRESH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

/** Attach a live refresh token, lasting the full refresh-token TTL. */
export function setRefreshCookie(response: NextResponse, token: string): NextResponse {
  response.headers.append("set-cookie", serialize(token, REFRESH_TTL_SECONDS));
  return response;
}

/**
 * Expire the cookie in the browser (logout, failed refresh, account deletion).
 *
 * `Max-Age=0` on the same name/path is what actually removes it. Omitting this on a failed refresh
 * is a real trap: the browser keeps retrying with a token the server has already rejected, so the
 * user sits in a loop that looks like the session "randomly" breaking.
 */
export function clearRefreshCookie(response: NextResponse): NextResponse {
  response.headers.append("set-cookie", serialize("", 0));
  return response;
}

/** Read the cookie off an incoming request without needing the `cookies()` helper. */
export function readRefreshCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === REFRESH_COOKIE) {
      const value = rest.join("=");
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
