import { ok, fail } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import {
  ALLOWED_RANGES,
  getInstagramDashboard,
  NotConnectedError,
} from "@/domains/automation/dashboard";
import { IgTokenRefreshError } from "@/domains/platform/ensure-token";

/**
 * GET /api/instagram/dashboard?range=7|30|90 — takes over from `InstagramDashboardController`.
 *
 * An unrecognised `range` falls back to 30 rather than erroring, matching the Java. The values are a
 * fixed set because each one costs a fan-out of Graph calls; letting a caller pass `range=3650` would
 * be a free way to exhaust the account's API quota.
 */

/** Dozens of Graph calls, including one per post. The default function timeout is too short. */
export const maxDuration = 60;

export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const raw = Number(new URL(request.url).searchParams.get("range"));
  const range = (ALLOWED_RANGES as readonly number[]).includes(raw) ? raw : 30;

  try {
    return ok(await getInstagramDashboard(userId, range));
  } catch (error) {
    if (error instanceof NotConnectedError) {
      return fail("not_connected", error.message, 404);
    }
    if (error instanceof IgTokenRefreshError) {
      // The connection needs re-authorising. 400 + `instagram_error` is what the UI already handles.
      return fail("instagram_error", error.message, 400);
    }
    return unexpected(error);
  }
}
