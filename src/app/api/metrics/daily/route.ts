import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { parseDateRange } from "@/lib/date-range";
import { getDailyMetrics } from "@/domains/platform/daily-snapshot";

/**
 * GET /api/metrics/daily?startDate=&endDate= — takes over from `MetricsController.getDailyMetrics`.
 * The Performance Trends graph. Reads stored snapshots; see `getDailyMetrics` for why that is
 * unavoidable for follower history.
 */
export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }
  const range = parseDateRange(request);
  if (range.error) return range.error;
  try {
    return ok(await getDailyMetrics(userId, range.startDate, range.endDate));
  } catch (error) {
    return unexpected(error);
  }
}
