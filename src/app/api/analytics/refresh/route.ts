import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { aggregateTotals, captureLive } from "@/domains/platform/daily-snapshot";

/**
 * POST /api/analytics/refresh — takes over from `AnalyticsRefreshController.refreshAllMetrics`.
 *
 * Refreshes every connected platform, then returns the aggregated totals plus a per-platform
 * breakdown.
 *
 * **The Spring version also published an `AnalyticsUpdatedEvent` to trigger gamification evaluation.
 * That is not ported, because nothing consumes it** — the gamification listener was removed before
 * this migration started. Reproducing a publish with no subscriber would be dead code that looks
 * load-bearing. Noted rather than silently dropped.
 *
 * Worth knowing: this endpoint has **no frontend call sites**. It is ported for parity so Spring can
 * be switched off without an unexplained gap, but it may well be dead.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    await captureLive(userId);
    const breakdown = await aggregateTotals(userId);
    const sum = (key: keyof (typeof breakdown)[string]) =>
      Object.values(breakdown).reduce((total, p) => total + p[key], 0);

    return ok({
      totalVideos: sum("totalVideos"),
      totalFollowers: sum("totalFollowers"),
      totalComments: sum("totalComments"),
      totalViews: sum("totalViews"),
      platformsRefreshed: Object.keys(breakdown).length,
      perPlatformBreakdown: breakdown,
    });
  } catch (error) {
    return unexpected(error);
  }
}
