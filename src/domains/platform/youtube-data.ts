import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toIso, toNumber } from "@/lib/serialize";
import { ensureFreshToken } from "./ensure-token";

/**
 * YouTube channel and video data. Ports `YouTubeDataService`.
 *
 * **Reads come from the database; only the `/sync` endpoints call YouTube.** That split is the
 * Java's and is worth keeping: the Data API has a hard daily quota, so a page load that hit it
 * directly would exhaust the quota for every user on the account.
 */

const DATA_API = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS_PER_PAGE = 50;
/** Ceiling on a single sync, so one call cannot burn the whole day's quota. */
const DEFAULT_MAX_VIDEOS = 200;
const CALL_TIMEOUT_MS = 15_000;

export class NoChannelError extends Error {
  constructor(message = "No YouTube channel connected") {
    super(message);
    this.name = "NoChannelError";
  }
}

export class YouTubeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export interface YouTubeChannelDto {
  channelId: string;
  title: string | null;
  description: string | null;
  customUrl: string | null;
  country: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  isConnected: boolean;
}

export interface YouTubeVideoDto {
  videoId: string;
  channelId: string;
  title: string | null;
  description: string | null;
  duration: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  privacyStatus: string | null;
  categoryId: string | null;
}

/**
 * ISO-8601 duration (`PT4M13S`) to seconds.
 *
 * YouTube returns durations in this form, and the frontend's `durationSeconds` is a number. Hours are
 * included because long-form uploads and live replays exceed an hour routinely.
 */
export function durationToSeconds(duration: string | null): number | null {
  if (!duration) return null;
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!m) return null;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
  );
}

/** The user's live YouTube connection, with a token guaranteed fresh. */
async function connection(userId: number): Promise<{ accountId: string; channelId: string; token: string }> {
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

  // Refreshes if near expiry; false means the connection needs re-authorising, and calling the API
  // with a dead token produces a less informative error than saying so here.
  const usable = await ensureFreshToken(String(row.id));
  if (!usable) {
    throw new YouTubeApiError("YouTube connection needs to be reconnected.");
  }

  const tokens = await db.execute<{ [key: string]: unknown; access_token: string | null }>(sql`
    SELECT access_token FROM connected_accounts WHERE id = ${String(row.id)}::uuid
  `);
  const token = tokens[0]?.access_token;
  if (!token) throw new YouTubeApiError("No usable YouTube access token. Please reconnect.");

  return {
    accountId: String(row.id),
    channelId: String(row.external_account_id),
    token,
  };
}

type Json = Record<string, unknown>;

async function api(path: string, params: Record<string, string>, token: string): Promise<Json> {
  const query = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const response = await fetch(`${DATA_API}${path}?${query}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const body = (await response.json()) as Json;
    if (!response.ok) {
      const error = body.error as { message?: string } | undefined;
      throw new YouTubeApiError(error?.message ?? `YouTube API ${response.status}`);
    }
    return body;
  } catch (error) {
    if (error instanceof YouTubeApiError) throw error;
    throw new YouTubeApiError(
      `YouTube API call failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ==================== CHANNEL ====================

export async function getChannelForUser(userId: number): Promise<YouTubeChannelDto | null> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT yc.channel_id, yc.title, yc.description, yc.custom_url, yc.country, yc.published_at,
           yc.thumbnail_url, yc.subscriber_count, yc.video_count, yc.view_count,
           ca.connected_at, ca.last_synced_at, ca.revoked, ca.connection_status
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    JOIN youtube_channels yc ON yc.channel_id = ca.external_account_id
    WHERE ca.user_id = ${userId} AND p.platform_name = 'YOUTUBE'
    ORDER BY ca.connected_at DESC LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    channelId: String(row.channel_id),
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    customUrl: (row.custom_url as string) ?? null,
    country: (row.country as string) ?? null,
    publishedAt: toIso(row.published_at as string),
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    subscriberCount: toNumber(row.subscriber_count as string),
    videoCount: toNumber(row.video_count as string),
    viewCount: toNumber(row.view_count as string),
    connectedAt: toIso(row.connected_at as string),
    lastSyncedAt: toIso(row.last_synced_at as string),
    isConnected: row.revoked === false && row.connection_status === "CONNECTED",
  };
}

export async function syncChannelData(userId: number): Promise<YouTubeChannelDto> {
  const { accountId, channelId, token } = await connection(userId);

  const body = await api(
    "/channels",
    { part: "snippet,statistics,contentDetails", id: channelId },
    token,
  );
  const items = body.items as Json[] | undefined;
  if (!Array.isArray(items) || items.length === 0) {
    throw new YouTubeApiError(`Channel not found: ${channelId}`);
  }
  const snippet = (items[0].snippet ?? {}) as Json;
  const statistics = (items[0].statistics ?? {}) as Json;
  const thumbnails = (snippet.thumbnails ?? {}) as Json;
  const high = (thumbnails.high ?? {}) as Json;

  // `statistics` values are strings in the API response, hence the coercion.
  const n = (v: unknown): number | null => (v == null ? null : toNumber(String(v)));

  await db.execute(sql`
    INSERT INTO youtube_channels
      (channel_id, title, description, custom_url, country, published_at, thumbnail_url,
       subscriber_count, video_count, view_count, created_at, updated_at)
    VALUES (${channelId}, ${(snippet.title as string) ?? ""}, ${(snippet.description as string) ?? null},
            ${(snippet.customUrl as string) ?? null}, ${(snippet.country as string) ?? null},
            ${(snippet.publishedAt as string) ?? null}, ${(high.url as string) ?? null},
            ${n(statistics.subscriberCount)}, ${n(statistics.videoCount)}, ${n(statistics.viewCount)},
            now(), now())
    ON CONFLICT (channel_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      custom_url = EXCLUDED.custom_url,
      country = EXCLUDED.country,
      published_at = EXCLUDED.published_at,
      thumbnail_url = EXCLUDED.thumbnail_url,
      subscriber_count = EXCLUDED.subscriber_count,
      video_count = EXCLUDED.video_count,
      view_count = EXCLUDED.view_count,
      updated_at = now()
  `);
  await db.execute(sql`
    UPDATE connected_accounts SET last_synced_at = now() WHERE id = ${accountId}::uuid
  `);

  const channel = await getChannelForUser(userId);
  if (!channel) throw new YouTubeApiError("Channel row disappeared after sync");
  return channel;
}

// ==================== VIDEOS ====================

export async function getVideosForChannel(
  channelId: string,
  limit: number,
): Promise<YouTubeVideoDto[]> {
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT video_id, channel_id, title, description, duration, published_at, thumbnail_url,
           privacy_status, category_id
    FROM youtube_videos
    WHERE channel_id = ${channelId}
    ORDER BY published_at DESC NULLS LAST
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    videoId: String(row.video_id),
    channelId: String(row.channel_id),
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    duration: (row.duration as string) ?? null,
    durationSeconds: durationToSeconds((row.duration as string) ?? null),
    publishedAt: toIso(row.published_at as string),
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    privacyStatus: (row.privacy_status as string) ?? null,
    categoryId: (row.category_id as string) ?? null,
  }));
}

export async function getVideo(
  channelId: string,
  videoId: string,
): Promise<YouTubeVideoDto | null> {
  // Scoped to the channel, not looked up by id alone — otherwise any signed-in user could read any
  // video row by guessing an id. The Java achieved this by listing the channel's videos and
  // filtering; doing it in the WHERE clause is the same check without loading everything.
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT video_id, channel_id, title, description, duration, published_at, thumbnail_url,
           privacy_status, category_id
    FROM youtube_videos WHERE channel_id = ${channelId} AND video_id = ${videoId}
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    videoId: String(row.video_id),
    channelId: String(row.channel_id),
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    duration: (row.duration as string) ?? null,
    durationSeconds: durationToSeconds((row.duration as string) ?? null),
    publishedAt: toIso(row.published_at as string),
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    privacyStatus: (row.privacy_status as string) ?? null,
    categoryId: (row.category_id as string) ?? null,
  };
}

/** The uploads playlist holds every public upload; there is no "list a channel's videos" endpoint. */
async function uploadsPlaylistId(channelId: string, token: string): Promise<string> {
  const body = await api("/channels", { part: "contentDetails", id: channelId }, token);
  const items = body.items as Json[] | undefined;
  const related = ((items?.[0]?.contentDetails ?? {}) as Json).relatedPlaylists as Json | undefined;
  const uploads = related?.uploads;
  if (typeof uploads !== "string") {
    throw new YouTubeApiError(`No uploads playlist for channel ${channelId}`);
  }
  return uploads;
}

async function playlistVideoIds(
  playlistId: string,
  token: string,
  max: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < max) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: String(Math.min(MAX_RESULTS_PER_PAGE, max - ids.length)),
    };
    if (pageToken) params.pageToken = pageToken;

    const body = await api("/playlistItems", params, token);
    const items = body.items as Json[] | undefined;
    if (!Array.isArray(items) || items.length === 0) break;
    for (const item of items) {
      const id = ((item.contentDetails ?? {}) as Json).videoId;
      if (typeof id === "string") ids.push(id);
    }
    const next = body.nextPageToken;
    if (typeof next !== "string") break;
    pageToken = next;
  }
  return ids;
}

export interface SyncResult {
  count: number;
  message: string;
}

export async function syncVideos(
  userId: number,
  maxVideos?: number | null,
): Promise<SyncResult> {
  const { accountId, channelId, token } = await connection(userId);
  const max = Math.min(maxVideos && maxVideos > 0 ? maxVideos : DEFAULT_MAX_VIDEOS, 500);

  const playlist = await uploadsPlaylistId(channelId, token);
  const ids = await playlistVideoIds(playlist, token, max);

  let written = 0;
  // Batched at 50 because that is the `/videos` endpoint's per-call id limit. Each batch is persisted
  // before the next is fetched, so a failure part-way leaves the earlier batches saved rather than
  // discarding the whole sync.
  for (let i = 0; i < ids.length; i += MAX_RESULTS_PER_PAGE) {
    const batch = ids.slice(i, i + MAX_RESULTS_PER_PAGE);
    const body = await api(
      "/videos",
      { part: "snippet,contentDetails,status", id: batch.join(",") },
      token,
    );
    const items = (body.items as Json[] | undefined) ?? [];

    for (const item of items) {
      const snippet = (item.snippet ?? {}) as Json;
      const contentDetails = (item.contentDetails ?? {}) as Json;
      const status = (item.status ?? {}) as Json;
      const thumbnails = (snippet.thumbnails ?? {}) as Json;
      const high = (thumbnails.high ?? {}) as Json;
      const tags = Array.isArray(snippet.tags) ? (snippet.tags as string[]).join(",") : null;

      await db.execute(sql`
        INSERT INTO youtube_videos
          (video_id, channel_id, title, description, duration, published_at, thumbnail_url,
           privacy_status, live_broadcast_content, category_id, tags, created_at, updated_at)
        VALUES (${String(item.id)}, ${channelId}, ${(snippet.title as string) ?? ""},
                ${(snippet.description as string) ?? null}, ${(contentDetails.duration as string) ?? null},
                ${(snippet.publishedAt as string) ?? null}, ${(high.url as string) ?? null},
                ${(status.privacyStatus as string) ?? null},
                ${(snippet.liveBroadcastContent as string) ?? null},
                ${(snippet.categoryId as string) ?? null}, ${tags}, now(), now())
        ON CONFLICT (video_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          duration = EXCLUDED.duration,
          published_at = EXCLUDED.published_at,
          thumbnail_url = EXCLUDED.thumbnail_url,
          privacy_status = EXCLUDED.privacy_status,
          live_broadcast_content = EXCLUDED.live_broadcast_content,
          category_id = EXCLUDED.category_id,
          tags = EXCLUDED.tags,
          updated_at = now()
      `);
      written++;
    }
  }

  await db.execute(sql`
    UPDATE connected_accounts SET last_synced_at = now() WHERE id = ${accountId}::uuid
  `);
  console.info(`[youtube] synced ${written} videos for channel ${channelId}`);
  return { count: written, message: "Videos synced successfully" };
}

/** The connected channel id, for routes that need it before reading videos. */
export async function connectedChannelId(userId: number): Promise<string | null> {
  const rows = await db.execute<{ [key: string]: unknown; external_account_id: string }>(sql`
    SELECT ca.external_account_id
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    WHERE ca.user_id = ${userId} AND p.platform_name = 'YOUTUBE'
    ORDER BY ca.connected_at DESC LIMIT 1
  `);
  return rows[0] ? String(rows[0].external_account_id) : null;
}
