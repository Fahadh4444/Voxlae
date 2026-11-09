import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { clearRefreshCookie } from "@/lib/refresh-cookie";
import { deleteAccount } from "@/domains/identity/account-deletion";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/**
 * DELETE /api/account — takes over from `AccountController.deleteAccount`.
 *
 * Returns **204 with no body**, as Spring did, and clears the refresh cookie on the way out. Without
 * that the browser keeps a token for a user row that no longer exists, and the next refresh produces
 * a confusing 401 rather than a clean signed-out state.
 *
 * The access token cannot be revoked — it is a signed JWT and stays syntactically valid until it
 * expires. It is harmless, because every route resolves the user from the database and there is no
 * longer a row to find, but it is worth knowing the token does not stop verifying.
 */
export async function DELETE(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const result = await deleteAccount(userId);
    if (!result) return fail("not_found", "User not found", 404);
    console.info(
      `[account] deleted user ${userId} (${result.youtubeChannels} YouTube channel(s) purged)`,
    );
    return clearRefreshCookie(new NextResponse(null, { status: 204 }));
  } catch (error) {
    return unexpected(error);
  }
}
