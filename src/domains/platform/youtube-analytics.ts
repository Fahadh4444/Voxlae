import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureFreshToken } from "./ensure-token";
import { NoChannelError, YouTubeApiError } from "./youtube-data";

/**
 * YouTube Analytics ingestion. Ports `YouTubeAnalyticsService`.
 *
 * **A different API from the Data API** used by `youtube-data.ts`: `youtubeanalytics.googleapis.com`
 * serves per-day reports and needs the `yt-analytics.readonly` scope, which the connection already
 * carries. The Data API cannot return daily history at all, which is why both exist.
 *
 * These are the only writers of `youtube_video_daily_metrics` — the weekly `YouTubeScheduledJobs`
 * used to call them, and nothing does now, which is why that table is empty across the whole
 * database. Retained as on-demand endpoints, consistent with dropping the crons.
 */

const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";
const METRICS = [
  "views",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "dislikes",
  "comments",
  "shares",
] as const;
/** Row layout of the report: day first, then `METRICS` in order. */
const EXPECTED_COLUMNS = 1 + METRICS.length;
const CALL_TIMEOUT_MS = 20_000;
/**
 * Videos per batch run.
 *
 * Sized by **wall clock, not quota**. Each Analytics report takes roughly ten seconds, so 34 videos
 * is ~340s — past the route's 300s `maxDuration`, and the request is killed with the work half done.
 * Twenty leaves comfortable margin.
 *
 * Videos that already have data for the requested window are skipped, so calling this repeatedly
 * walks through the channel instead of redoing the same twenty. The response reports what is left.
 */
const MAX_VIDEOS_PER_RUN = 20;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Default window: the last 30 days, ending yesterday. */
export function defaultRange(): { startDate: string; endDate: string } {
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return { startDate: ymd(start), endDate: ymd(end) };
}

interface Connection {
  accountId: string;
  channelId: string;
  token: string;
}

async function connection(userId: number): Promise<Connection> {
  const rows = await db.execute<{
    [key: string]: unknown;
    id: string;
    external_account_id: string;
  }>(sql`
    SELECT ca.id, ca.external_account_id
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    WHERE ca.user_id = ${userId} AND p.platform_name = 'YOUTUBE' AND ca.revoked = false
    ORDER BY ca.connected_at DESC LIMIT 1
  `);
  const row = rows[0];
  if (!row) throw new NoChannelError();

  if (!(await ensureFreshToken(String(row.id)))) {
    throw new YouTubeApiError("YouTube connection needs to be reconnected.");
  }
  const tokens = await db.execute<{ [key: string]: unknown; access_token: string | null }>(sql`
    SELECT access_token FROM connected_accounts WHERE id = ${String(row.id)}::uuid
  `);
  const token = tokens[0]?.access_token;
  if (!token) throw new YouTubeApiError("No usable YouTube access token. Please reconnect.");

  return { accountId: String(row.id), channelId: String(row.external_account_id), token };
}

/**
 * One video's daily report.
 *
 * Returns `[]` rather than throwing when the report is empty — a video published after the window, or
 * one with no views, legitimately has no rows, and a batch ingest must not abort on the first of those.
 */
async function fetchVideoReport(
  channelId: string,
  videoId: string,
  startDate: string,
  endDate: string,
  token: string,
): Promise<unknown[][]> {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    filters: `video==${videoId}`,
    startDate,
    endDate,
    metrics: METRICS.join(","),
    dimensions: "day",
    sort: "day",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await fetch(`${ANALYTICS_API}/reports?${params}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error as { message?: string } | undefined;
      throw new YouTubeApiError(
        error?.message ?? `YouTube Analytics API ${response.status}`,
      );
    }
    const rows = body.rows;
    return Array.isArray(rows) ? (rows as unknown[][]) : [];
  } catch (error) {
    if (error instanceof YouTubeApiError) throw error;
    throw new YouTubeApiError(
      `YouTube Analytics call failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Persist a report's rows. Returns how many days were written.
 *
 * `ON CONFLICT DO NOTHING` on (video_id, metric_date) makes re-ingesting a window idempotent, and is
 * also why the Java's per-row existence check is unnecessary — one statement replaces a query per day.
 *
 * Rows shorter than expected are skipped: the API occasionally omits a trailing metric, and reading
 * past the end would silently shift every value into the wrong column.
 */
async function persistRows(videoId: string, rows: unknown[][]): Promise<number> {
  let written = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < EXPECTED_COLUMNS) continue;
    const [day, views, minutes, avgDuration, avgPercentage, dislikes, comments, shares] = row;
    const inserted = await db.execute<{ [key: string]: unknown; id: string }>(sql`
      INSERT INTO youtube_video_daily_metrics
        (video_id, metric_date, views, estimated_minutes_watched, average_view_duration,
         average_view_percentage, dislikes, comments, shares)
      VALUES (${videoId}, ${String(day)}::date, ${Number(views) || 0}, ${Number(minutes) || 0},
              ${Math.round(Number(avgDuration) || 0)}, ${Number(avgPercentage) || 0},
              ${Number(dislikes) || 0}, ${Number(comments) || 0}, ${Number(shares) || 0})
      ON CONFLICT (video_id, metric_date) DO NOTHING
      RETURNING id
    `);
    if (inserted.length > 0) written++;
  }
  return written;
}

export interface IngestResult {
  ingested: number;
  videos: number;
  startDate: string;
  endDate: string;
}

/** Ingest one video. The video must belong to the caller's own channel. */
export async function ingestVideoAnalytics(
  userId: number,
  videoId: string,
  startDate?: string,
  endDate?: string,
): Promise<IngestResult> {
  const { channelId, token } = await connection(userId);
  const range = { ...defaultRange(), ...(startDate && { startDate }), ...(endDate && { endDate }) };

  // Scoped to the channel, so a guessed id cannot be used to pull another creator's analytics.
  const owned = await db.execute<{ [key: string]: unknown; video_id: string }>(sql`
    SELECT video_id FROM youtube_videos WHERE video_id = ${videoId} AND channel_id = ${channelId}
  `);
  if (owned.length === 0) throw new YouTubeApiError(`Video not found: ${videoId}`);

  const rows = await fetchVideoReport(channelId, videoId, range.startDate, range.endDate, token);
  return { ingested: await persistRows(videoId, rows), videos: 1, ...range };
}

/**
 * Ingest every video on the channel, newest first.
 *
 * One Analytics call per video, each persisted before the next is fetched, so a failure part-way
 * keeps what was already written. A single video failing does not abort the run — a deleted or
 * private video would otherwise block every video behind it.
 */
export async function ingestAllVideoAnalytics(
  userId: number,
  startDate?: string,
  endDate?: string,
): Promise<IngestResult & { failed: number; remaining: number }> {
  const { channelId, token } = await connection(userId);
  const range = { ...defaultRange(), ...(startDate && { startDate }), ...(endDate && { endDate }) };

  /**
   * Only videos with no data yet for this window.
   *
   * `NOT EXISTS` rather than a `LEFT JOIN ... IS NULL`: a video partially covered by the window should
   * still be skipped once it has any row in range, because the report is fetched for the whole window
   * at once and re-fetching it would spend ten seconds to insert nothing.
   */
  const pending = await db.execute<{ [key: string]: unknown; video_id: string }>(sql`
    SELECT v.video_id FROM youtube_videos v
    WHERE v.channel_id = ${channelId}
      AND NOT EXISTS (
        SELECT 1 FROM youtube_video_daily_metrics m
        WHERE m.video_id = v.video_id
          AND m.metric_date BETWEEN ${range.startDate}::date AND ${range.endDate}::date
      )
    ORDER BY v.published_at DESC NULLS LAST
  `);
  const videos = pending.slice(0, MAX_VIDEOS_PER_RUN);
  const remaining = Math.max(pending.length - videos.length, 0);

  let ingested = 0;
  let failed = 0;
  for (const video of videos) {
    const videoId = String(video.video_id);
    try {
      const rows = await fetchVideoReport(channelId, videoId, range.startDate, range.endDate, token);
      ingested += await persistRows(videoId, rows);
    } catch (error) {
      failed++;
      console.warn(
        `[youtube-analytics] ${videoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  console.info(
    `[youtube-analytics] ingested ${ingested} day-rows across ${videos.length} video(s), ` +
      `${failed} failed, ${remaining} video(s) still pending`,
  );
  return { ingested, videos: videos.length, failed, remaining, ...range };
}

// ==================== LIVE READS ====================

/**
 * `/api/youtube/analytics/channel` — channel totals over a range, **fetched live** from the Analytics
 * API rather than summed from `platform_daily_snapshot` as the Java did.
 *
 * Live because YouTube serves this history on request, so storing it bought nothing but staleness —
 * the same reasoning as the dashboard. `netSubscribers` comes from gained − lost, which is what the
 * Java's snapshot-based `netFollowerChange` approximated from stored totals.
 */
export interface ChannelAnalyticsSummary {
  channelId: string;
  channelTitle: string;
  totalViews: number;
  totalWatchTimeMinutes: number;
  netSubscribers: number;
  totalComments: number;
}

export async function getChannelAnalyticsLive(
  userId: number,
  startDate: string,
  endDate: string,
): Promise<ChannelAnalyticsSummary> {
  const { connection: live, report } = await import("./youtube-dashboard");
  const conn = await live(userId);
  const [rows, titleRows] = await Promise.all([
    report(
      conn,
      startDate,
      endDate,
      "views,estimatedMinutesWatched,comments,subscribersGained,subscribersLost",
    ),
    db.execute<{ [key: string]: unknown; title: string | null }>(sql`
      SELECT title FROM youtube_channels WHERE channel_id = ${conn.channelId}
    `),
  ]);
  // No dimension, so a single totals row: [views, minutes, comments, gained, lost].
  const r = rows[0] ?? [];
  const n = (i: number) => Number(r[i]) || 0;
  return {
    channelId: conn.channelId,
    channelTitle: titleRows[0]?.title ?? "",
    totalViews: n(0),
    totalWatchTimeMinutes: n(1),
    totalComments: n(2),
    netSubscribers: n(3) - n(4),
  };
}

/**
 * `/api/youtube/analytics/video/{id}` — one video's daily metrics, **fetched live**.
 *
 * **Ownership is checked explicitly, against `youtube_videos`.** Scoping the report to
 * `ids=channel==<own channel>` does *not* make a foreign video return nothing: YouTube zero-fills every
 * day for it. That leaks nobody's numbers — verified, all zeros — but it makes someone else's video
 * look like "your video with no views", which is wrong. So a video not on the caller's channel is a
 * `VideoNotFoundError`. Stricter than the Java, which read stored metrics by video id with no ownership
 * check at all.
 *
 * `engagementRate` is `(comments + shares) / views` as a **fraction**, matching the Java entity — not
 * a percentage.
 */
export class VideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`Video not found on your channel: ${videoId}`);
    this.name = "VideoNotFoundError";
  }
}

export interface VideoDailyMetric {
  videoId: string;
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

export async function getVideoAnalyticsLive(
  userId: number,
  videoId: string,
  startDate: string,
  endDate: string,
): Promise<VideoDailyMetric[]> {
  const { connection: live, report } = await import("./youtube-dashboard");
  const conn = await live(userId);

  const owned = await db.execute<{ [key: string]: unknown; video_id: string }>(sql`
    SELECT video_id FROM youtube_videos WHERE video_id = ${videoId} AND channel_id = ${conn.channelId}
  `);
  if (owned.length === 0) throw new VideoNotFoundError(videoId);

  const rows = await report(
    conn,
    startDate,
    endDate,
    "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,comments,shares",
    "day",
    "day",
    undefined,
    `video==${videoId}`,
  );
  return rows
    .filter((row) => row.length >= 7)
    .map((row) => {
      const views = Number(row[1]) || 0;
      const comments = Number(row[5]) || 0;
      const shares = Number(row[6]) || 0;
      return {
        videoId,
        date: String(row[0]),
        views,
        estimatedMinutesWatched: Number(row[2]) || 0,
        averageViewDuration: Math.round(Number(row[3]) || 0),
        averageViewPercentage: Number(row[4]) || 0,
        comments,
        shares,
        engagementRate: views > 0 ? (comments + shares) / views : 0,
      };
    });
}
