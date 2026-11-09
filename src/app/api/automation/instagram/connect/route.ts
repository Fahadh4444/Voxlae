import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse } from "@/lib/auth-errors";
import { getConnection } from "@/domains/automation/connection";
import { buildAuthorizationUrl } from "@/domains/automation/oauth";

/**
 * GET /api/automation/instagram/connect — takes over from
 * `InstagramAutomationAuthController.connect`.
 *
 * `returnTo` is carried through the signed state as a **hint**, not a URL, and mapped through a
 * whitelist in the callback. Putting a real URL in the state would turn a valid signature into an
 * open redirect the callback trusts.
 */
export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const existing = await getConnection(userId);
  if (existing?.active) {
    return fail(
      "already_connected",
      "An Instagram account is already connected for automations. Disconnect it first.",
      400,
    );
  }

  const returnTo = new URL(request.url).searchParams.get("returnTo");
  return ok({
    authorizationUrl: buildAuthorizationUrl(userId, returnTo),
    message: "Redirect the user to this URL to connect Instagram for automations",
  });
}
