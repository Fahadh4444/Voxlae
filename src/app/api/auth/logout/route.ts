import { ok } from "@/lib/api-response";
import { clearRefreshCookie, readRefreshCookie } from "@/lib/refresh-cookie";
import { revokeRefreshToken } from "@/domains/identity/refresh-token";

/**
 * POST /api/auth/logout — takes over from `AuthController.logout`.
 *
 * Always succeeds and always clears the cookie, even with no token or an unknown one. Logout that
 * can fail is worse than useless: the user believes they signed out while the cookie is still in the
 * browser.
 */
export async function POST(request: Request) {
  const token = readRefreshCookie(request);
  if (token) {
    await revokeRefreshToken(token);
  }
  const response = ok(
    { success: true, message: "Logged out successfully" },
    "Logged out successfully",
  );
  return clearRefreshCookie(response);
}
