import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { captureLive } from "@/domains/platform/daily-snapshot";

/**
 * POST /api/metrics/sync — takes over from `MetricsController.sync`.
 *
 * Captures today's follower totals after refreshing them from the platforms. **Idempotent** — the
 * insert is `ON CONFLICT DO NOTHING` on (account, date), so pressing sync twice in a day does not
 * create a second row or overwrite the first.
 *
 * This is the on-demand half of what the retired `daily-snapshot` cron did. The other half runs
 * automatically on session boot from cached counts; see `docs/crons.md`.
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
    const result = await captureLive(userId);
    const written = result.youtube + result.instagram;
    /**
     * `written: 0` is the normal, correct answer when today's snapshot already exists — the insert is
     * `ON CONFLICT DO NOTHING`, so a second sync in the same day writes nothing. Saying so explicitly,
     * because a bare zero reads as a failure and would send someone hunting for a bug.
     */
    return ok(
      // `daysWritten` is the field the UI's `syncMetrics()` is typed to read (Spring's SyncResult).
      { daysWritten: written, written, ...result },
      written > 0
        ? "Today's snapshot captured"
        : "Today's snapshot was already captured; platform counts refreshed",
    );
  } catch (error) {
    return unexpected(error);
  }
}
