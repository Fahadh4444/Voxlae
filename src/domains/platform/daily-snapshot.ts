import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Opportunistic follower-history capture — the replacement for the `daily-snapshot` cron.
 *
 * Why this exists at all, rather than simply dropping the job: follower totals are the one metric
 * that cannot be fetched retroactively. `DailySnapshotService` says so in its own words — *"follower
 * history is never fabricated"* — and it is true of the platforms, not just the code. YouTube
 * Analytics serves 90 days of daily *views* on request, so view history really can be re-fetched
 * live. Neither the Graph API nor YouTube will tell you how many followers an account had last
 * Tuesday. A day that is not recorded is gone.
 *
 * So instead of a scheduled sweep over every user, a day's row is written when the user's own
 * session touches the app. That is a real trade and worth stating plainly: history now has gaps on
 * the days a creator does not open Voxlae, where the cron would have filled every day. What it buys
 * is no scheduled job, no fan-out queue, and no work done for dormant accounts.
 *
 * It costs **no platform API calls**. Both counts are already cached by the connect/live-fetch paths
 * (`ig_automation_connections.followers_count`, `youtube_channels.subscriber_count`); this only
 * promotes what is already there into a dated row.
 */

export interface SnapshotResult {
  day: string;
  youtube: number;
  instagram: number;
}

/**
 * Record today's follower totals for one user, if not already recorded.
 *
 * `ON CONFLICT DO NOTHING` rather than an update: the first write of the day wins. A later full
 * analytics capture writing the same day's row — with real views/reach/engagement rather than the
 * zeros here — must not be clobbered by a second session boot carrying only a follower count.
 */
export async function captureTodayIfMissing(userId: number): Promise<SnapshotResult> {
  const day = new Date().toISOString().slice(0, 10);
  const result: SnapshotResult = { day, youtube: 0, instagram: 0 };

  try {
    // YouTube: keyed by the connected account, which is how the unique constraint is defined.
    // `subscriber_count > 0` guards against writing a placeholder zero — the column defaults to 0,
    // so an unsynced channel is indistinguishable from a channel with no subscribers, and
    // `followers_total` is nullable precisely so "not captured" renders as no-data rather than zero.
    const youtube = await db.execute(sql`
      INSERT INTO platform_daily_snapshot
        (connected_account_id, user_id, platform, snapshot_date, followers_total)
      SELECT ca.id, ca.user_id, 'YOUTUBE', ${day}::date, yc.subscriber_count
      FROM connected_accounts ca
      JOIN platforms p ON p.platform_id = ca.platform_id
      JOIN youtube_channels yc ON yc.channel_id = ca.external_account_id
      WHERE ca.user_id = ${userId}
        AND ca.revoked = false
        AND p.platform_name = 'YOUTUBE'
        AND yc.subscriber_count IS NOT NULL
        AND yc.subscriber_count > 0
      ON CONFLICT (connected_account_id, snapshot_date) DO NOTHING
      RETURNING id
    `);
    result.youtube = youtube.length;
  } catch (error) {
    console.warn(`[daily-snapshot] YouTube capture for user ${userId}: ${describe(error)}`);
  }

  try {
    // Instagram rows carry a NULL `connected_account_id` (V40 moved Instagram off
    // `connected_accounts`), so they are constrained by the *partial* unique index instead — and
    // `ON CONFLICT` has to restate that index's predicate to match it.
    const instagram = await db.execute(sql`
      INSERT INTO platform_daily_snapshot
        (connected_account_id, user_id, platform, snapshot_date, followers_total)
      SELECT NULL, c.user_id, 'INSTAGRAM', ${day}::date, c.followers_count
      FROM ig_automation_connections c
      WHERE c.user_id = ${userId}
        AND c.status = 'CONNECTED'
        AND c.followers_count IS NOT NULL
      ON CONFLICT (user_id, platform, snapshot_date)
        WHERE connected_account_id IS NULL
        DO NOTHING
      RETURNING id
    `);
    result.instagram = instagram.length;
  } catch (error) {
    console.warn(`[daily-snapshot] Instagram capture for user ${userId}: ${describe(error)}`);
  }

  return result;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Capture today's snapshot after refreshing the counts **live**. Ports
 * `DailySnapshotService.captureForUser`.
 *
 * The difference from `captureTodayIfMissing` is where the numbers come from: that one promotes
 * whatever is already cached (free, suitable for session boot), while this one asks the platforms
 * first. `POST /api/metrics/sync` uses this, so a creator pressing "sync" gets today's real figure
 * rather than yesterday's cache promoted into today's row.
 *
 * Each platform is refreshed independently and failures are swallowed per platform, matching the
 * Java's "non-blocking" comment: a dead YouTube token must not stop the Instagram snapshot being
 * written, because a missed day cannot be recovered later.
 */
export async function captureLive(userId: number): Promise<SnapshotResult> {
  // YouTube: syncChannelData writes subscriber_count back to youtube_channels, which is what the
  // snapshot insert below reads.
  try {
    const { syncChannelData } = await import("./youtube-data");
    await syncChannelData(userId);
  } catch (error) {
    console.warn(
      `[daily-snapshot] YouTube refresh skipped for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // Instagram: refreshConnectionProfile writes followers_count back to ig_automation_connections.
  try {
    const { refreshConnectionProfile } = await import("@/domains/automation/oauth");
    await refreshConnectionProfile(userId);
  } catch (error) {
    console.warn(
      `[daily-snapshot] Instagram refresh skipped for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return captureTodayIfMissing(userId);
}

export interface PlatformTotals {
  totalFollowers: number;
  totalViews: number;
  totalVideos: number;
  totalComments: number;
}

/**
 * Current totals per platform, read from the stored profile rows.
 *
 * Read rather than re-fetched: the caller is expected to have just refreshed them (as
 * `/api/analytics/refresh` does), and asking the platforms twice in one request would double the
 * API cost for the same numbers.
 */
export async function aggregateTotals(
  userId: number,
): Promise<Record<string, PlatformTotals>> {
  const out: Record<string, PlatformTotals> = {};

  const youtube = await db.execute<Record<string, unknown>>(sql`
    SELECT yc.subscriber_count, yc.view_count, yc.video_count
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    JOIN youtube_channels yc ON yc.channel_id = ca.external_account_id
    WHERE ca.user_id = ${userId} AND ca.revoked = false AND p.platform_name = 'YOUTUBE'
  `);
  if (youtube[0]) {
    out.YOUTUBE = {
      totalFollowers: Number(youtube[0].subscriber_count ?? 0),
      totalViews: Number(youtube[0].view_count ?? 0),
      totalVideos: Number(youtube[0].video_count ?? 0),
      // YouTube comment totals live in per-video analytics, which needs the Analytics API ingest —
      // reported as 0 rather than guessed.
      totalComments: 0,
    };
  }

  const instagram = await db.execute<Record<string, unknown>>(sql`
    SELECT followers_count, media_count FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED'
  `);
  if (instagram[0]) {
    out.INSTAGRAM = {
      totalFollowers: Number(instagram[0].followers_count ?? 0),
      // Instagram exposes no lifetime view total; the dashboard reports it per window instead.
      totalViews: 0,
      totalVideos: Number(instagram[0].media_count ?? 0),
      totalComments: 0,
    };
  }

  return out;
}

/**
 * `/api/metrics/daily` — the Performance Trends graph. Ports `MetricsController.getDailyMetrics`.
 *
 * **Stored by necessity, not by leftover design:** follower totals are the one metric no platform
 * serves retroactively, so this history only exists because it was captured on the day.
 *
 * Instagram's account-level `views` is often unavailable (it needs newer API permissions), so a zero
 * falls back to `reach`, the meaningful daily activity signal — as the Java did.
 */
export interface DailySnapshotDto {
  date: string;
  platform: string;
  followersTotal: number | null;
  views: number | null;
}

export async function getDailyMetrics(
  userId: number,
  startDate: string,
  endDate: string,
): Promise<DailySnapshotDto[]> {
  const rows = await db.execute<{
    [key: string]: unknown;
    snapshot_date: string;
    platform: string;
    followers_total: string | number | null;
    views: string | number | null;
    reach: string | number | null;
  }>(sql`
    SELECT snapshot_date::text AS snapshot_date, platform, followers_total, views, reach
    FROM platform_daily_snapshot
    WHERE user_id = ${userId}
      AND snapshot_date BETWEEN ${startDate}::date AND ${endDate}::date
    ORDER BY snapshot_date ASC
  `);
  return rows.map((r) => {
    let views = r.views == null ? 0 : Number(r.views);
    if (r.platform === "INSTAGRAM" && views === 0 && r.reach != null) views = Number(r.reach);
    return {
      date: String(r.snapshot_date).slice(0, 10),
      platform: r.platform,
      // null stays null: "not captured that day" must render as no data, not as zero followers.
      followersTotal: r.followers_total == null ? null : Number(r.followers_total),
      views,
    };
  });
}
