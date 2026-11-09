/**
 * Instagram Graph API client. Ports the dashboard half of `InstagramGraphClient`.
 *
 * Every method **degrades rather than throws**: Meta deprecates and renames metrics between API
 * versions, and a single unavailable one must blank one card, not the whole dashboard. That is why
 * each metric is requested individually instead of in one comma-separated batch — a batch containing
 * one unsupported name 400s in its entirety.
 */

const BASE_URL = process.env.INSTAGRAM_GRAPH_BASE_URL ?? "https://graph.instagram.com";
const API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v21.0";

function base(): string {
  return `${BASE_URL}/${API_VERSION}`;
}

/** 10s per Graph call. A dashboard fans out dozens; one slow call must not hold the whole request. */
const CALL_TIMEOUT_MS = 10_000;

export interface IgProfile {
  id: string | null;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
}

export interface TimePoint {
  date: string | null;
  value: number;
}
export interface MetricSeries {
  metric: string;
  points: TimePoint[];
  total: number;
}
export interface KeyVal {
  key: string;
  value: number;
}
export interface MediaItem {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
}
export interface MediaInsight {
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  totalInteractions: number | null;
}

type Json = Record<string, unknown>;

/**
 * One Graph GET. Returns null on any failure — transport, timeout, or a Meta `error` object.
 *
 * Meta answers some errors with HTTP 200 and an `error` body, so the status alone is not a reliable
 * success check.
 */
async function getJson(url: string, what: string): Promise<Json | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = (await response.json()) as Json;
    if (!response.ok || body.error) {
      const error = body.error as { message?: string } | undefined;
      console.debug(`[ig-graph] ${what}: ${error?.message ?? `HTTP ${response.status}`}`);
      return null;
    }
    return body;
  } catch (error) {
    console.debug(
      `[ig-graph] ${what}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export async function fetchProfile(
  igUserId: string,
  token: string,
): Promise<IgProfile | null> {
  const fields =
    "user_id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count,account_type";
  const json = await getJson(
    `${base()}/${igUserId}?fields=${fields}&access_token=${encodeURIComponent(token)}`,
    "fetch profile",
  );
  if (!json) return null;
  return {
    id: str(json.user_id) ?? str(json.id),
    username: str(json.username),
    name: str(json.name),
    profilePictureUrl: str(json.profile_picture_url),
    followersCount: num(json.followers_count),
    followsCount: num(json.follows_count),
    mediaCount: num(json.media_count),
    accountType: str(json.account_type),
  };
}

/**
 * Daily time series per metric (`metric_type=time_series`).
 *
 * Only some account metrics support this. Asking for a `total_value`-only metric here 400s, which is
 * why the caller keeps two separate metric lists.
 */
export async function getAccountTimeSeries(
  igUserId: string,
  metrics: string[],
  since: number,
  until: number,
  token: string,
): Promise<MetricSeries[]> {
  const results = await Promise.all(
    metrics.map(async (metric) => {
      const json = await getJson(
        `${base()}/${igUserId}/insights?metric=${metric}&period=day&metric_type=time_series` +
          `&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
        `insights ${metric}`,
      );
      const data = json?.data as Json[] | undefined;
      if (!Array.isArray(data) || data.length === 0) return null;
      const values = data[0].values as Json[] | undefined;
      const points: TimePoint[] = [];
      let total = 0;
      if (Array.isArray(values)) {
        for (const v of values) {
          const value = num(v.value) ?? 0;
          points.push({ date: str(v.end_time), value });
          total += value;
        }
      }
      return { metric, points, total };
    }),
  );
  return results.filter((r): r is MetricSeries => r !== null);
}

/**
 * A single aggregated total per metric over the window (`metric_type=total_value`).
 *
 * Required for `views`, `accounts_engaged`, `total_interactions` and `likes`, which the time-series
 * call cannot return. `views` (v22+) and `impressions` (pre-v22) are the same metric renamed, so both
 * are requested and whichever the live API version exposes is the one that comes back.
 */
export async function getAccountTotals(
  igUserId: string,
  metrics: string[],
  since: number,
  until: number,
  token: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    metrics.map(async (metric) => {
      const json = await getJson(
        `${base()}/${igUserId}/insights?metric=${metric}&period=day&metric_type=total_value` +
          `&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
        `insights total ${metric}`,
      );
      const data = json?.data as Json[] | undefined;
      if (!Array.isArray(data) || data.length === 0) return;
      const tv = data[0].total_value as Json | undefined;
      out[metric] = num(tv?.value) ?? 0;
    }),
  );
  return out;
}

/** Follower demographics by age, gender, country and city. */
export async function getFollowerDemographics(
  igUserId: string,
  token: string,
): Promise<Record<string, KeyVal[]>> {
  const out: Record<string, KeyVal[]> = {};
  await Promise.all(
    ["age", "gender", "country", "city"].map(async (breakdown) => {
      const json = await getJson(
        `${base()}/${igUserId}/insights?metric=follower_demographics&period=lifetime` +
          `&metric_type=total_value&timeframe=this_month&breakdown=${breakdown}` +
          `&access_token=${encodeURIComponent(token)}`,
        `demographics ${breakdown}`,
      );
      const data = json?.data as Json[] | undefined;
      if (!Array.isArray(data) || data.length === 0) return;
      const tv = data[0].total_value as Json | undefined;
      const breakdowns = tv?.breakdowns as Json[] | undefined;
      if (!Array.isArray(breakdowns) || breakdowns.length === 0) return;
      const rows = breakdowns[0].results as Json[] | undefined;
      if (!Array.isArray(rows)) return;
      const kvs: KeyVal[] = [];
      for (const row of rows) {
        const dims = row.dimension_values as unknown[] | undefined;
        kvs.push({
          key: Array.isArray(dims) && dims.length > 0 ? String(dims[0]) : "",
          value: num(row.value) ?? 0,
        });
      }
      if (kvs.length > 0) out[breakdown] = kvs;
    }),
  );
  return out;
}

/** Per-media insights. Returns all-null rather than throwing when unavailable for a post. */
export async function getMediaInsights(
  mediaId: string,
  token: string,
): Promise<MediaInsight> {
  const empty: MediaInsight = {
    reach: null,
    likes: null,
    comments: null,
    saved: null,
    shares: null,
    views: null,
    totalInteractions: null,
  };
  const json = await getJson(
    `${base()}/${mediaId}/insights?metric=reach,likes,comments,saved,shares,total_interactions,views` +
      `&access_token=${encodeURIComponent(token)}`,
    "media insights",
  );
  const data = json?.data as Json[] | undefined;
  if (!Array.isArray(data)) return empty;

  const m: Record<string, number> = {};
  for (const metric of data) {
    const values = metric.values as Json[] | undefined;
    const value =
      Array.isArray(values) && values.length > 0 ? (num(values[0].value) ?? 0) : 0;
    const name = str(metric.name);
    if (name) m[name] = value;
  }
  return {
    reach: m.reach ?? null,
    likes: m.likes ?? null,
    comments: m.comments ?? null,
    saved: m.saved ?? null,
    shares: m.shares ?? null,
    views: m.views ?? null,
    totalInteractions: m.total_interactions ?? null,
  };
}

export interface MediaPage {
  items: MediaItem[];
  nextCursor: string | null;
}

/** One page of recent media, newest first. */
export async function fetchMedia(
  igUserId: string,
  after: string | null,
  limit: number,
  token: string,
): Promise<MediaPage> {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  let url =
    `${base()}/${igUserId}/media?fields=${fields}&limit=${limit}` +
    `&access_token=${encodeURIComponent(token)}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;

  const json = await getJson(url, "fetch media");
  const data = json?.data as Json[] | undefined;
  const items: MediaItem[] = Array.isArray(data)
    ? data.map((m) => ({
        id: String(m.id),
        caption: str(m.caption),
        mediaType: str(m.media_type),
        mediaUrl: str(m.media_url),
        thumbnailUrl: str(m.thumbnail_url),
        permalink: str(m.permalink),
        timestamp: str(m.timestamp),
      }))
    : [];

  // `next` is checked as well as the cursor: Meta returns an `after` cursor on the last page too, so
  // paging on the cursor alone loops forever on a fixed set of posts.
  const paging = json?.paging as Json | undefined;
  const cursors = paging?.cursors as Json | undefined;
  const nextCursor = paging?.next && cursors?.after ? String(cursors.after) : null;

  return { items, nextCursor };
}

// ==================== OUTBOUND (automations) ====================

/**
 * A Graph error that Meta marked as rate limiting.
 *
 * Distinguished from every other failure because it is the only one worth retrying — codes 4, 17
 * and 613 are "too many calls", while 10 or 200 are permission problems that will fail identically
 * forever.
 */
export class GraphSendError extends Error {
  constructor(
    message: string,
    readonly rateLimited: boolean,
  ) {
    super(message);
    this.name = "GraphSendError";
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 613]);

/** POST to the Graph API. Throws `GraphSendError` — unlike the read path, a failed send must surface. */
async function postJson(
  url: string,
  body: Json | null,
  what: string,
): Promise<Json> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      ...(body
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => ({}))) as Json;
    const error = json.error as { message?: string; code?: number } | undefined;
    if (!response.ok || error) {
      const code = error?.code;
      throw new GraphSendError(
        `${what} failed: ${error?.message ?? `HTTP ${response.status}`}`,
        response.status === 429 || (typeof code === "number" && RATE_LIMIT_CODES.has(code)),
      );
    }
    return json;
  } catch (error) {
    if (error instanceof GraphSendError) throw error;
    // A timeout or transport failure is treated as retryable: the request may not have reached Meta.
    throw new GraphSendError(
      `${what} failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Public reply beneath a comment. */
export async function replyToComment(
  commentId: string,
  message: string,
  token: string,
): Promise<void> {
  await postJson(
    `${base()}/${commentId}/replies?message=${encodeURIComponent(message)}` +
      `&access_token=${encodeURIComponent(token)}`,
    null,
    "public comment reply",
  );
}

async function sendMessage(
  igUserId: string,
  recipient: Json,
  message: Json,
  token: string,
  what: string,
): Promise<void> {
  await postJson(
    `${base()}/${igUserId}/messages?access_token=${encodeURIComponent(token)}`,
    { recipient, message },
    what,
  );
}

/**
 * Private reply to a comment — a DM the comment itself authorises.
 *
 * Allowed **once per comment, within 7 days**, with no prior conversation. That is what makes the
 * whole comment-to-DM automation possible; a plain `sendDirectMessage` to a stranger is refused.
 */
export async function sendPrivateReply(
  igUserId: string,
  commentId: string,
  text: string,
  token: string,
): Promise<void> {
  await sendMessage(igUserId, { comment_id: commentId }, { text }, token, "private reply");
}

/** DM to a known IGSID. Requires an already-open conversation — used after a follow-gate tap. */
export async function sendDirectMessage(
  igUserId: string,
  recipientIgsid: string,
  text: string,
  token: string,
): Promise<void> {
  await sendMessage(igUserId, { id: recipientIgsid }, { text }, token, "direct message");
}

/**
 * A message carrying a single postback button — the follow gate's "Verify" action.
 *
 * `recipient` is `{ comment_id }` for the first prompt (the comment authorises it) and `{ id }` for
 * a re-prompt once the conversation exists.
 */
export async function sendButtonMessage(
  igUserId: string,
  recipient: Json,
  text: string,
  buttonTitle: string,
  buttonPayload: string,
  token: string,
): Promise<void> {
  await sendMessage(
    igUserId,
    recipient,
    {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text,
          buttons: [{ type: "postback", title: buttonTitle, payload: buttonPayload }],
        },
      },
    },
    token,
    "button message",
  );
}

export interface IgUserProfile {
  username: string | null;
  name: string | null;
  userFollowsBusiness: boolean | null;
  businessFollowsUser: boolean | null;
  followerCount: number | null;
}

/**
 * Profile of a user who has interacted with the business.
 *
 * `is_user_follow_business` is **only** present once the user has consented by messaging or tapping
 * a button — which is exactly why the follow gate asks them to tap before checking. Calling this for
 * a cold commenter returns a consent error, not `false`, so a failure here must not be read as
 * "not following".
 */
export async function getUserProfile(
  igsid: string,
  token: string,
): Promise<IgUserProfile | null> {
  const json = await getJson(
    `${base()}/${igsid}?fields=name,username,is_user_follow_business,is_business_follow_user,follower_count` +
      `&access_token=${encodeURIComponent(token)}`,
    "get user profile",
  );
  if (!json) return null;
  return {
    username: str(json.username),
    name: str(json.name),
    userFollowsBusiness:
      typeof json.is_user_follow_business === "boolean" ? json.is_user_follow_business : null,
    businessFollowsUser:
      typeof json.is_business_follow_user === "boolean" ? json.is_business_follow_user : null,
    followerCount: num(json.follower_count),
  };
}

/** Subscribe the account to comment + message webhook fields. */
export async function subscribeWebhooks(igUserId: string, token: string): Promise<void> {
  await postJson(
    `${base()}/${igUserId}/subscribed_apps?subscribed_fields=comments,messages` +
      `&access_token=${encodeURIComponent(token)}`,
    null,
    "subscribe webhooks",
  );
}

export interface IgAccount {
  igUserId: string | null;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
}

/**
 * `GET /me` — the connected account, resolved from the token alone.
 *
 * Used during the OAuth callback, before any id is known. `user_id` is the Instagram-scoped id that
 * arrives on webhooks; `id` is the app-scoped one, so the former is preferred where both appear.
 */
export async function fetchAccountInfo(token: string): Promise<IgAccount | null> {
  const json = await getJson(
    `${base()}/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count` +
      `&access_token=${encodeURIComponent(token)}`,
    "fetch account info",
  );
  if (!json) return null;
  return {
    igUserId: str(json.user_id) ?? str(json.id),
    username: str(json.username),
    name: str(json.name),
    profilePictureUrl: str(json.profile_picture_url),
    followersCount: num(json.followers_count),
    mediaCount: num(json.media_count),
  };
}

/**
 * Trim a permalink to a comparable form: lowercase, no query string, no trailing slash.
 *
 * Instagram's own permalinks and the ones a creator pastes from the app differ in exactly those
 * three ways, so a raw string comparison almost never matches.
 */
function normalizePermalink(url: string | null): string {
  if (!url) return "";
  let u = url.trim().toLowerCase();
  const q = u.indexOf("?");
  if (q >= 0) u = u.slice(0, q);
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

/**
 * Resolve a pasted post/reel link to its media id by scanning recent media.
 *
 * Instagram offers **no permalink→id lookup**, so this pages through the account's own media looking
 * for a match. Bounded to ~200 items: a link to a very old post will not resolve, and the UI falls
 * back to picking from the list. Unbounded scanning would burn the account's API budget on a link
 * that may not belong to them at all.
 */
export async function resolveByPermalink(
  igUserId: string,
  permalink: string,
  token: string,
): Promise<MediaItem | null> {
  const needle = normalizePermalink(permalink);
  if (!needle) return null;

  let after: string | null = null;
  for (let page = 0; page < 8; page++) {
    const result: MediaPage = await fetchMedia(igUserId, after, 25, token);
    for (const item of result.items) {
      if (normalizePermalink(item.permalink) === needle) return item;
    }
    if (!result.nextCursor) break;
    after = result.nextCursor;
  }
  return null;
}
