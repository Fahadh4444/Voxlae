import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureFreshToken } from "./ensure-token";
import { durationToSeconds, NoChannelError, YouTubeApiError } from "./youtube-data";

/**
 * The YouTube analytics dashboard, composed **live** from the YouTube Analytics API.
 *
 * Deliberately different from the Java, which read `platform_daily_snapshot` and
 * `youtube_video_daily_metrics` and fell back to live reports only when those were empty. Everything
 * here is fetched on request, matching the Instagram dashboard and the "fetch live data" direction
 * this migration took: the numbers are whatever YouTube says right now, with no ingest step standing
 * between the creator and their own analytics.
 *
 * The cost is one fan-out of Analytics calls per page load rather than a table read. That is
 * acceptable because the reports are per-channel (not per-video) except for the video table, which is
 * a single ranked report rather than one call per video.
 */

const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_API = "https://www.googleapis.com/youtube/v3";
const CALL_TIMEOUT_MS = 20_000;
/** Rows in the top-videos table. A ranked report, so this is one call regardless of the number. */
const VIDEO_CAP = 15;

export const ALLOWED_RANGES = [7, 30, 90] as const;

export interface YtPoint {
  date: string;
  value: number;
}
export interface YtSeries {
  metric: string;
  points: YtPoint[];
  total: number;
  previousTotal: number | null;
}
export interface YtKpi {
  key: string;
  label: string;
  value: number;
  previous: number | null;
}
export interface YtBucket {
  key: string;
  value: number;
}
export interface YtTrafficSource {
  source: string;
  percent: number;
}
export interface YtFormatStat {
  format: string;
  count: number;
  avgEngagementRate: number;
  avgViews: number;
  avgWatchMinutes: number;
}
export interface YtVideoRow {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  permalink: string;
  views: number;
  watchMinutes: number;
  avgViewDurationSecs: number;
  avgViewPercentage: number | null;
  comments: number;
  shares: number;
  engagementRate: number | null;
  type: string;
}
export interface YouTubeDashboard {
  profile: {
    channelId: string;
    title: string;
    customUrl: string | null;
    thumbnailUrl: string | null;
    subscribers: number;
    totalViews: number;
    videoCount: number;
  };
  rangeDays: number;
  kpis: YtKpi[];
  views: YtSeries;
  watchTime: YtSeries;
  subscribers: YtSeries;
  age: YtBucket[];
  gender: YtBucket[];
  topCountries: YtBucket[];
  trafficSources: YtTrafficSource[];
  formats: YtFormatStat[];
  videos: YtVideoRow[];
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const round1 = (v: number) => Math.round(v * 10) / 10;

export interface Conn {
  channelId: string;
  token: string;
}

export async function connection(userId: number): Promise<Conn> {
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
  return { channelId: String(row.external_account_id), token };
}

/**
 * One Analytics report. Returns `[]` on any failure rather than throwing.
 *
 * Degrading per-report is the whole design: YouTube withholds demographics on channels below its
 * privacy threshold, and a small channel must still get its views and watch time rather than an
 * error page. One blank card beats a blank dashboard.
 */
export async function report(
  conn: Conn,
  start: string,
  end: string,
  metrics: string,
  dimensions?: string,
  sort?: string,
  maxResults?: number,
  filters?: string,
): Promise<unknown[][]> {
  const params = new URLSearchParams({
    ids: `channel==${conn.channelId}`,
    startDate: start,
    endDate: end,
    metrics,
  });
  if (dimensions) params.set("dimensions", dimensions);
  if (sort) params.set("sort", sort);
  // Some reports (notably `dimensions=video`) are rejected as invalid without maxResults.
  if (maxResults) params.set("maxResults", String(maxResults));
  if (filters) params.set("filters", filters);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await fetch(`${ANALYTICS_API}?${params}`, {
      headers: { authorization: `Bearer ${conn.token}` },
      signal: controller.signal,
    });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const error = body.error as { message?: string } | undefined;
      console.warn(`[yt-dashboard] ${metrics}/${dimensions ?? "-"}: ${error?.message ?? response.status}`);
      return [];
    }
    return Array.isArray(body.rows) ? (body.rows as unknown[][]) : [];
  } catch (error) {
    console.warn(
      `[yt-dashboard] ${metrics}/${dimensions ?? "-"} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Channel profile straight from the Data API, so subscriber/view totals are current. */
async function fetchProfile(conn: Conn) {
  try {
    const response = await fetch(
      `${DATA_API}/channels?part=snippet,statistics&id=${conn.channelId}`,
      { headers: { authorization: `Bearer ${conn.token}` }, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
    );
    const body = (await response.json()) as Record<string, unknown>;
    const item = (body.items as Record<string, unknown>[] | undefined)?.[0];
    if (!item) return null;
    const snippet = (item.snippet ?? {}) as Record<string, unknown>;
    const statistics = (item.statistics ?? {}) as Record<string, unknown>;
    const thumbs = (snippet.thumbnails ?? {}) as Record<string, unknown>;
    const high = (thumbs.high ?? {}) as Record<string, unknown>;
    return {
      title: (snippet.title as string) ?? "",
      customUrl: (snippet.customUrl as string) ?? null,
      thumbnailUrl: (high.url as string) ?? null,
      subscribers: Number(statistics.subscriberCount ?? 0) || 0,
      totalViews: Number(statistics.viewCount ?? 0) || 0,
      videoCount: Number(statistics.videoCount ?? 0) || 0,
    };
  } catch {
    return null;
  }
}

/** `ageGroup13-17` → `13-17`; gender codes → readable labels. Ports `prettyDim`. */
function prettyDim(raw: string): string {
  const s = raw.replace(/^age/i, "").replace(/_/g, "-");
  switch (s.toUpperCase()) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "USER-GENDER-OTHER":
      return "Other";
    default:
      return s;
  }
}

/** Ports `prettySource`. */
function prettySource(raw: string): string {
  switch (raw) {
    case "SUBSCRIBER":
      return "Library / Subs";
    case "NOTIFICATION":
      return "Notifications";
    case "YT_SEARCH":
      return "YouTube search";
    case "RELATED_VIDEO":
      return "Suggested videos";
    case "SHORTS_FEED":
      return "Shorts feed";
    case "EXTERNAL_URL":
      return "External";
    default:
      return raw ? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, " ") : "";
  }
}

export function sumColumn(rows: unknown[][], index: number): number {
  return rows.reduce((total, row) => total + (Number(row[index]) || 0), 0);
}

export async function getYouTubeDashboard(
  userId: number,
  rangeDays: number,
): Promise<YouTubeDashboard> {
  const conn = await connection(userId);

  // Ends yesterday: YouTube's same-day figures are partial, and charting them makes the newest point
  // always look like a collapse.
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - (rangeDays - 1) * 86_400_000);
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * 86_400_000);
  const [S, E, PS, PE] = [ymd(start), ymd(end), ymd(prevStart), ymd(prevEnd)];

  const [profile, daily, prevDaily, engagement, prevEngagement, age, gender, countries, traffic, topVideos] =
    await Promise.all([
      fetchProfile(conn),
      report(conn, S, E, "views,estimatedMinutesWatched,subscribersGained,subscribersLost", "day", "day"),
      report(conn, PS, PE, "views,estimatedMinutesWatched,subscribersGained,subscribersLost", "day", "day"),
      report(conn, S, E, "likes,comments,shares"),
      report(conn, PS, PE, "likes,comments,shares"),
      report(conn, S, E, "viewerPercentage", "ageGroup"),
      report(conn, S, E, "viewerPercentage", "gender"),
      report(conn, S, E, "views", "country", "-views", 5),
      report(conn, S, E, "views", "insightTrafficSourceType"),
      report(
        conn,
        S,
        E,
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,comments,shares",
        "video",
        "-views",
        VIDEO_CAP,
      ),
    ]);

  // Daily rows: [day, views, minutes, subsGained, subsLost]
  const viewPoints = daily.map((r) => ({ date: String(r[0]), value: Number(r[1]) || 0 }));
  const watchPoints = daily.map((r) => ({ date: String(r[0]), value: Number(r[2]) || 0 }));

  const viewsTotal = sumColumn(daily, 1);
  const prevViews = sumColumn(prevDaily, 1);
  const watchTotal = sumColumn(daily, 2);
  const prevWatch = sumColumn(prevDaily, 2);
  const netSubs = sumColumn(daily, 3) - sumColumn(daily, 4);
  const prevNetSubs = sumColumn(prevDaily, 3) - sumColumn(prevDaily, 4);

  /**
   * Subscribers is a **level**, so the series is reconstructed by walking today's total backwards
   * through each day's net change. The daily report only gives gained/lost, and plotting those as if
   * they were the subscriber count is the same flow-vs-level mistake that made the Instagram
   * dashboard report growth of -4 in a month that gained 86.
   */
  const currentSubs = profile?.subscribers ?? 0;
  const subPoints: YtPoint[] = [];
  let running = currentSubs;
  for (let i = daily.length - 1; i >= 0; i--) {
    subPoints.unshift({ date: String(daily[i][0]), value: running });
    running -= (Number(daily[i][3]) || 0) - (Number(daily[i][4]) || 0);
  }

  const likes = engagement[0] ? Number(engagement[0][0]) || 0 : 0;
  const comments = engagement[0] ? Number(engagement[0][1]) || 0 : 0;
  const shares = engagement[0] ? Number(engagement[0][2]) || 0 : 0;
  const prevLikes = prevEngagement[0] ? Number(prevEngagement[0][0]) || 0 : 0;
  const prevComments = prevEngagement[0] ? Number(prevEngagement[0][1]) || 0 : 0;
  const prevShares = prevEngagement[0] ? Number(prevEngagement[0][2]) || 0 : 0;

  const engagementRate = viewsTotal > 0 ? ((likes + comments + shares) / viewsTotal) * 100 : 0;
  const prevEngagementRate =
    prevViews > 0 ? ((prevLikes + prevComments + prevShares) / prevViews) * 100 : 0;

  const kpis: YtKpi[] = [
    { key: "subscribers", label: "Subscribers", value: currentSubs, previous: currentSubs - netSubs },
    { key: "views", label: "Views", value: viewsTotal, previous: prevViews },
    { key: "watch_time", label: "Watch time (min)", value: watchTotal, previous: prevWatch },
    { key: "subscribers_gained", label: "Net subscribers", value: netSubs, previous: prevNetSubs },
    { key: "likes", label: "Likes", value: likes, previous: prevLikes },
    { key: "comments", label: "Comments", value: comments, previous: prevComments },
    {
      key: "engagement_rate",
      label: "Engagement rate",
      value: round1(engagementRate),
      previous: round1(prevEngagementRate),
    },
  ];

  const toBuckets = (rows: unknown[][]): YtBucket[] =>
    rows
      .filter((r) => r.length >= 2)
      .map((r) => ({ key: prettyDim(String(r[0])), value: Math.round(Number(r[1]) || 0) }))
      .sort((a, b) => b.value - a.value);

  /**
   * YouTube offers no `viewerPercentage × country` report, so geography comes from views-by-country
   * converted to a share. Labelled as a percentage like the other two so the UI can render them
   * identically.
   */
  const countryTotal = Math.max(sumColumn(countries, 1), 1);
  const topCountries: YtBucket[] = countries
    .filter((r) => r.length >= 2)
    .map((r) => ({
      key: String(r[0]),
      value: Math.round(((Number(r[1]) || 0) / countryTotal) * 100),
    }));

  const trafficTotal = Math.max(sumColumn(traffic, 1), 1);
  const trafficSources: YtTrafficSource[] = traffic
    .filter((r) => r.length >= 2)
    .map((r) => ({
      source: prettySource(String(r[0])),
      percent: round1(((Number(r[1]) || 0) / trafficTotal) * 100),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

  // Titles, thumbnails and durations come from the stored video rows — the Analytics API returns ids
  // only, and a Data API call per video would be 15 extra round trips for metadata that does not
  // change. `POST /api/youtube/videos/sync` is what keeps them current.
  const videoIds = topVideos.map((r) => String(r[0]));
  const meta = new Map<string, { title: string; thumb: string | null; published: string | null; duration: string | null }>();
  if (videoIds.length > 0) {
    const ids = sql.join(videoIds.map((id) => sql`${id}`), sql`, `);
    const rows = await db.execute<Record<string, unknown>>(sql`
      SELECT video_id, title, thumbnail_url, published_at, duration
      FROM youtube_videos WHERE video_id IN (${ids})
    `);
    for (const row of rows) {
      meta.set(String(row.video_id), {
        title: (row.title as string) ?? "",
        thumb: (row.thumbnail_url as string) ?? null,
        published: row.published_at ? String(row.published_at).slice(0, 10) : null,
        duration: (row.duration as string) ?? null,
      });
    }
  }

  const videos: YtVideoRow[] = topVideos
    .filter((r) => r.length >= 7)
    .map((r) => {
      const videoId = String(r[0]);
      const views = Number(r[1]) || 0;
      const watchMinutes = Number(r[2]) || 0;
      const avgDuration = Math.round(Number(r[3]) || 0);
      const avgPercentage = Number(r[4]) || 0;
      const videoComments = Number(r[5]) || 0;
      const videoShares = Number(r[6]) || 0;
      const info = meta.get(videoId);
      const seconds = durationToSeconds(info?.duration ?? null);
      return {
        videoId,
        title: info?.title ?? videoId,
        thumbnailUrl: info?.thumb ?? null,
        publishedAt: info?.published ?? null,
        permalink: `https://www.youtube.com/watch?v=${videoId}`,
        views,
        watchMinutes,
        avgViewDurationSecs: avgDuration,
        avgViewPercentage: round1(avgPercentage),
        comments: videoComments,
        shares: videoShares,
        engagementRate: views > 0 ? round1(((videoComments + videoShares) / views) * 100) : null,
        // YouTube exposes no "is this a Short" flag; duration is the only signal, and 3 minutes is
        // the current Shorts ceiling.
        type: seconds !== null && seconds <= 180 ? "Short" : "Video",
      };
    });

  const byType = new Map<string, YtVideoRow[]>();
  for (const video of videos) {
    const list = byType.get(video.type) ?? [];
    list.push(video);
    byType.set(video.type, list);
  }
  const formats: YtFormatStat[] = [...byType.entries()]
    .map(([format, rows]) => {
      const rated = rows.filter((r) => r.engagementRate !== null);
      return {
        format,
        count: rows.length,
        avgEngagementRate: rated.length
          ? round1(rated.reduce((t, r) => t + (r.engagementRate ?? 0), 0) / rated.length)
          : 0,
        avgViews: Math.round(rows.reduce((t, r) => t + r.views, 0) / rows.length),
        avgWatchMinutes: Math.round(rows.reduce((t, r) => t + r.watchMinutes, 0) / rows.length),
      };
    })
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

  return {
    profile: {
      channelId: conn.channelId,
      title: profile?.title ?? "",
      customUrl: profile?.customUrl ?? null,
      thumbnailUrl: profile?.thumbnailUrl ?? null,
      subscribers: currentSubs,
      totalViews: profile?.totalViews ?? 0,
      videoCount: profile?.videoCount ?? 0,
    },
    rangeDays,
    kpis,
    views: { metric: "views", points: viewPoints, total: viewsTotal, previousTotal: prevViews },
    watchTime: {
      metric: "estimatedMinutesWatched",
      points: watchPoints,
      total: watchTotal,
      previousTotal: prevWatch,
    },
    subscribers: {
      metric: "subscribers",
      points: subPoints,
      total: netSubs,
      previousTotal: prevNetSubs,
    },
    age: toBuckets(age),
    gender: toBuckets(gender),
    topCountries,
    trafficSources,
    formats,
    videos,
  };
}
