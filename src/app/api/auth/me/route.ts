import { after } from "next/server";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { getMe } from "@/domains/identity/auth-service";
import { authErrorResponse } from "@/lib/auth-errors";
import { ensureFreshTokens } from "@/domains/platform/ensure-token";
import { captureTodayIfMissing } from "@/domains/platform/daily-snapshot";

/**
 * GET /api/auth/me — takes over from `AuthController.getMe`.
 *
 * Doubles as the frontend's session-liveness probe, so it must distinguish an expired token (refresh
 * and retry) from an invalid one (sign in again). `toAuthErrorResponse` does that.
 *
 * It is also the app's "this user is here right now" signal, which is what makes it the right place
 * for the two jobs that used to be crons — proactive token refresh and follower-history capture. See
 * `ensure-token.ts` and `daily-snapshot.ts` for why each no longer needs a schedule.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    const me = await getMe(claims.userId, claims.email);

    // `after` runs once the response is already on its way, so neither a slow Graph API refresh nor
    // a snapshot write shows up in session-load latency. Both swallow their own errors — nothing
    // here may turn a working session into a failed one.
    after(async () => {
      await ensureFreshTokens(claims.userId);
      await captureTodayIfMissing(claims.userId);
    });

    return ok(me);
  } catch (error) {
    return authErrorResponse(error);
  }
}
