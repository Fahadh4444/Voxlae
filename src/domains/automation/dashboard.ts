import { sql } from "drizzle-orm";
import { db } from "@/db";
import { validIgAccessToken } from "@/domains/platform/ensure-token";
import {
  fetchMedia,
  fetchProfile,
  getAccountTimeSeries,
  getAccountTotals,
  getFollowerDemographics,
  getMediaInsights,
  type MediaInsight,
  type MediaItem,
  type MetricSeries,
} from "./graph-client";

/**
 * The Instagram analytics dashboard. Ports `InstagramDashboardService`.
 *
 * Composed **live** from the Graph API on every request — there is no stored copy of any of this. The
 * whole page is one response so the UI renders in a single pass rather than waterfalling a dozen
 * fetches.
 *
 * Every section degrades independently. A metric Meta has renamed or withdrawn blanks one card;
 * nothing else is affected. That matters more here than almost anywhere else in the codebase, because
 * Instagram's insights metrics change between API versions without notice.
 */

const DAY = 86_400;
const MEDIA_CAP = 90; // most posts we pull per-media insights for
const MEDIA_PAGE = 50;
const MAX_MEDIA_PAGES = 6; // ~300 items scanned before giving up

/** Account metrics that support `metric_type=time_series` — these drive the charts. */
const SERIES_METRICS = ["reach", "follower_count"];

/**
 * Account metrics that only support `total_value` — these drive the headline KPIs.
 *
 * Requesting them as a time series 400s and blanks the card, which was a real bug once. `impressions`
 * is the pre-v22 name for `views`; both are asked for and whichever the live API version exposes wins.
 */
const TOTAL_METRICS = [
  "reach",
  "views",
  "impressions",
  "accounts_engaged",
  "total_interactions",
  "likes",
];

export const ALLOWED_RANGES = [7, 30, 90] as const;

export class NotConnectedError extends Error {
  constructor(message = "No Instagram account connected") {
    super(message);
    this.name = "NotConnectedError";
  }
}

export interface Bucket {
  key: string;
  value: number;
}
export interface Point {
  date: string | null;
  value: number;
}
export interface Series {
  metric: string;
  points: Point[];
  total: number;
  previousTotal: number | null;
}
export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous: number | null;
}
export interface PostRow {
  mediaId: string;
  type: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  engagementRate: number | null;
}
export interface FormatStat {
  format: string;
  count: number;
  avgEngagementRate: number;
  avgReach: number;
}
export interface InstagramDashboard {
  profile: {
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
    followers: number;
    following: number;
    mediaCount: number;
    accountType: string | null;
  };
  rangeDays: number;
  kpis: Kpi[];
  growth: Series;
  reach: Series;
  views: Series;
  age: Bucket[];
  gender: Bucket[];
  topCountries: Bucket[];
  topCities: Bucket[];
  onlineFollowers: { hour: number; value: number }[];
  formats: FormatStat[];
  posts: PostRow[];
}

const nz = (v: number | null | undefined): number => v ?? 0;
const round1 = (v: number): number => Math.round(v * 10) / 10;

function seriesTotal(map: Map<string, MetricSeries>, metric: string): number {
  return map.get(metric)?.total ?? 0;
}
function points(s: MetricSeries | undefined): Point[] {
  return s ? s.points.map((p) => ({ date: p.date, value: p.value })) : [];
}
/**
 * Followers gained across the window.
 *
 * **`follower_count` is a daily flow, not a running level** — each point is how many followers were
 * gained that day, and the series is not monotonic. So the net change is the **sum** of the points.
 *
 * The Java computed `last - first` here, which is the right formula for a level and meaningless for a
 * flow. On a real account it reported **-4 for a month in which 86 followers were gained**: the last
 * day happened to be quieter than the first, so the dashboard showed the account shrinking while it
 * grew. Only visible against live data — a synthetic series would have to be non-monotonic in exactly
 * the right way to expose it.
 */
function gained(s: MetricSeries | undefined): number {
  if (!s || s.points.length === 0) return 0;
  return s.points.reduce((sum, p) => sum + p.value, 0);
}

function buckets(kvs: { key: string; value: number }[] | undefined, top: number): Bucket[] {
  if (!kvs) return [];
  const mapped = kvs.map((kv) => ({ key: kv.key, value: kv.value }));
  if (top > 0) return mapped.sort((a, b) => b.value - a.value).slice(0, top);
  return mapped;
}

function formatOf(mediaType: string | null): string {
  switch (mediaType) {
    case "VIDEO":
    case "REELS":
      return "Reels";
    case "CAROUSEL_ALBUM":
      return "Carousel";
    case null:
      return "Post";
    default:
      return "Single";
  }
}

/** `2026-07-20T14:15:00+0000` → epoch seconds. 0 when unparseable. */
function parseIgTime(ts: string | null): number {
  if (!ts) return 0;
  // Instagram omits the colon in the offset, which `Date` rejects on some engines. Inserting it
  // makes the string ISO-8601 proper.
  const iso = ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

/**
 * Every post published on or after `since`, newest first.
 *
 * Media comes back newest-first, so paging stops at the first post outside the window — everything
 * after it is older. Bounded by `MEDIA_CAP` and `MAX_MEDIA_PAGES` so an account with thousands of
 * posts cannot make this request unbounded.
 */
async function fetchMediaInRange(
  igUserId: string,
  since: number,
  token: string,
): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_MEDIA_PAGES && out.length < MEDIA_CAP; page++) {
    const result: Awaited<ReturnType<typeof fetchMedia>> = await fetchMedia(
      igUserId,
      after,
      MEDIA_PAGE,
      token,
    );
    for (const item of result.items) {
      const ts = parseIgTime(item.timestamp);
      if (ts > 0 && ts < since) return out;
      out.push(item);
      if (out.length >= MEDIA_CAP) return out;
    }
    if (!result.nextCursor) break;
    after = result.nextCursor;
  }
  return out;
}

/**
 * Run `task` over `items` with at most `limit` in flight.
 *
 * The Java used a bounded thread pool for this. A bound is needed either way: one insights call per
 * post means up to 90 concurrent requests, which Meta rate-limits and which would open 90 sockets at
 * once. Order is preserved because results are written back by index.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      out[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

function toPostRow(m: MediaItem, insight: MediaInsight): PostRow {
  const reach = nz(insight.reach);
  const interactions = nz(insight.totalInteractions);
  return {
    mediaId: m.id,
    type: formatOf(m.mediaType),
    caption: m.caption,
    permalink: m.permalink,
    thumbnailUrl: m.thumbnailUrl ?? m.mediaUrl,
    timestamp: m.timestamp,
    reach,
    likes: nz(insight.likes),
    comments: nz(insight.comments),
    saves: nz(insight.saved),
    shares: nz(insight.shares),
    engagementRate: reach > 0 ? round1((interactions / reach) * 100) : null,
  };
}

function formatStats(posts: PostRow[]): FormatStat[] {
  const byFormat = new Map<string, PostRow[]>();
  for (const post of posts) {
    const list = byFormat.get(post.type) ?? [];
    list.push(post);
    byFormat.set(post.type, list);
  }
  const out: FormatStat[] = [];
  for (const [format, rows] of byFormat) {
    const rated = rows.filter((r) => r.engagementRate !== null);
    const avgEngagementRate =
      rated.length > 0
        ? rated.reduce((sum, r) => sum + (r.engagementRate ?? 0), 0) / rated.length
        : 0;
    const avgReach =
      rows.length > 0 ? rows.reduce((sum, r) => sum + r.reach, 0) / rows.length : 0;
    out.push({
      format,
      count: rows.length,
      avgEngagementRate: round1(avgEngagementRate),
      avgReach: Math.round(avgReach),
    });
  }
  return out.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
}

export async function getInstagramDashboard(
  userId: number,
  rangeDays: number,
): Promise<InstagramDashboard> {
  const rows = await db.execute<{
    [key: string]: unknown;
    id: string;
    ig_user_id: string;
  }>(sql`
    SELECT id, ig_user_id FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED' AND access_token IS NOT NULL
    ORDER BY connected_at DESC LIMIT 1
  `);
  const connection = rows[0];
  if (!connection) throw new NotConnectedError();

  const token = await validIgAccessToken(String(connection.id));
  const ig = String(connection.ig_user_id);

  const now = Math.floor(Date.now() / 1000);
  const since = now - rangeDays * DAY;
  const prevSince = since - rangeDays * DAY;

  // Every independent Graph call goes out at once. Run sequentially this took long enough at 30/90
  // days that the page felt broken; none of them depend on each other.
  const [profile, curList, prevList, curTotals, prevTotals, demographics, media] =
    await Promise.all([
      fetchProfile(ig, token),
      getAccountTimeSeries(ig, SERIES_METRICS, since, now, token),
      getAccountTimeSeries(ig, SERIES_METRICS, prevSince, since, token),
      getAccountTotals(ig, TOTAL_METRICS, since, now, token),
      getAccountTotals(ig, TOTAL_METRICS, prevSince, since, token),
      getFollowerDemographics(ig, token),
      fetchMediaInRange(ig, since, token),
    ]);

  const cur = new Map(curList.map((s) => [s.metric, s]));
  const prev = new Map(prevList.map((s) => [s.metric, s]));

  // Keep the cached counts in step with what is being displayed, so the My Platforms card and this
  // page never disagree. Also what `daily-snapshot.ts` reads, so opening the dashboard is what keeps
  // follower history flowing.
  if (profile) {
    await db.execute(sql`
      UPDATE ig_automation_connections
      SET followers_count = ${profile.followersCount ?? null},
          media_count = ${profile.mediaCount ?? null},
          last_refreshed_at = now(),
          updated_at = now()
      WHERE id = ${String(connection.id)}::uuid
    `);
  }

  const insights = await mapLimit(media, 6, (m) => getMediaInsights(m.id, token));
  const posts = media.map((m, i) => toPostRow(m, insights[i]));

  /**
   * "Accounts reached" uses the deduplicated period total, like native Instagram does, falling back
   * to the summed daily series when `total_value` is unavailable. Summing daily reach double-counts
   * anyone reached on more than one day, which inflates the number and makes engagement rate look
   * artificially low.
   */
  const reachTotal = curTotals.reach ?? seriesTotal(cur, "reach");
  const prevReach = prevTotals.reach ?? seriesTotal(prev, "reach");
  const viewsTotal = curTotals.views ?? curTotals.impressions ?? 0;
  const prevViews = prevTotals.views ?? prevTotals.impressions ?? 0;
  const interactions = curTotals.total_interactions ?? 0;
  const prevInteractions = prevTotals.total_interactions ?? 0;
  const engagementRate = reachTotal > 0 ? (interactions / reachTotal) * 100 : 0;
  const prevEngagementRate = prevReach > 0 ? (prevInteractions / prevReach) * 100 : 0;

  const kpis: Kpi[] = [
    {
      key: "followers",
      label: "Followers",
      value: nz(profile?.followersCount),
      /**
       * The follower count as it stood at the start of the window: today's total minus what was
       * gained during it. The API offers no historical total, so it has to be derived.
       *
       * The Java used the first point of the daily series instead, which is a day's *gain*, not a
       * total — it rendered as "1357 followers, previously 4".
       */
      previous: nz(profile?.followersCount) - gained(cur.get("follower_count")),
    },
    { key: "reach", label: "Accounts reached", value: reachTotal, previous: prevReach },
    { key: "views", label: "Content views", value: viewsTotal, previous: prevViews },
    {
      key: "engagement_rate",
      label: "Engagement rate",
      value: round1(engagementRate),
      previous: round1(prevEngagementRate),
    },
    // profile_views was discontinued by Meta in January 2025; Likes occupies its slot.
    {
      key: "likes",
      label: "Likes",
      value: curTotals.likes ?? 0,
      previous: prevTotals.likes ?? 0,
    },
    {
      key: "accounts_engaged",
      label: "Accounts engaged",
      value: curTotals.accounts_engaged ?? 0,
      previous: prevTotals.accounts_engaged ?? 0,
    },
    {
      key: "interactions",
      label: "Interactions",
      value: interactions,
      previous: prevInteractions,
    },
  ];

  return {
    profile: {
      username: profile?.username ?? null,
      name: profile?.name ?? null,
      avatarUrl: profile?.profilePictureUrl ?? null,
      followers: nz(profile?.followersCount),
      following: nz(profile?.followsCount),
      mediaCount: nz(profile?.mediaCount),
      accountType: profile?.accountType ?? null,
    },
    rangeDays,
    kpis,
    growth: {
      metric: "follower_count",
      points: points(cur.get("follower_count")),
      total: gained(cur.get("follower_count")),
      previousTotal: gained(prev.get("follower_count")),
    },
    reach: {
      metric: "reach",
      points: points(cur.get("reach")),
      total: reachTotal,
      previousTotal: prevReach,
    },
    // Account-level daily views is not offered by the API — only the period total — so this series
    // carries the KPI figure with no points, and the UI charts reach alone.
    views: { metric: "views", points: [], total: viewsTotal, previousTotal: prevViews },
    age: buckets(demographics.age, 0),
    gender: buckets(demographics.gender, 0),
    topCountries: buckets(demographics.country, 5),
    topCities: buckets(demographics.city, 5),
    // `online_followers` is not exposed by the Instagram-Login API at all, so best-time-to-post is
    // always empty and the UI omits the panel.
    onlineFollowers: [],
    formats: formatStats(posts),
    posts,
  };
}
