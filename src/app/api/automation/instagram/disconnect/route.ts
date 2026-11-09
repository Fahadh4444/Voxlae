import { requireRole } from "@/lib/auth";
import { ok } from "@/lib/api-response";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { disconnect } from "@/domains/automation/connection";

/**
 * DELETE /api/automation/instagram/disconnect — takes over from
 * `InstagramAutomationAuthController.disconnect`.
 *
 * **Idempotent**, matching the Java: already disconnected is a success from the user's point of view.
 * Returning 404 here (as an earlier version of this route did) makes the disconnect button show an
 * error for a state the user was trying to reach, and a UI that retries on failure would loop.
 *
 * A soft disconnect, not a delete — automations, keywords, targets, replies and the execution history
 * all cascade from the connection row, so removing it would destroy the creator's entire setup and
 * audit trail. Reconnecting the same account resumes against the same row.
 *
 * A genuine *failure* to persist is still reported. The Java notes why: a swallowed error here is
 * what once made the account reappear as connected on refresh.
 */
export async function DELETE(request: Request) {
  let userId: number;
  try {
    userId = (await requireRole(request, "INFLUENCER")).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const changed = await disconnect(userId);
    return ok(
      null,
      changed ? "Instagram account disconnected" : "No Instagram account was connected",
    );
  } catch (error) {
    return unexpected(error);
  }
}
