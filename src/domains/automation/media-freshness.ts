import { sql } from "drizzle-orm";
import { db } from "@/db";
import { validIgAccessToken } from "@/domains/platform/ensure-token";
import { fetchMedia, fetchProfile } from "./graph-client";

/**
 * Keeping Instagram image URLs usable.
 *
 * **Instagram CDN URLs are signed and expire.** Every one carries an `oe=<hex unix seconds>`
 * parameter, and after that instant the CDN answers **403**. Lifetime is roughly two to four weeks.
 *
 * The connect flow and the target picker both stored these URLs and served them indefinitely, so a
 * creator's avatar and post thumbnails silently turned into broken images a few weeks after they set
 * an automation up. Nothing logged, nothing failed — the CDN just stopped serving them. Present in
 * the Java too; it only needed time to show.
 *
 * The fix is to treat a stored URL as a **cache with a known expiry**: read `oe`, and re-fetch from
 * the Graph API only when it has passed. That keeps the common case free — no Graph call when the
 * URLs are still good — and one batched call when they are not.
 */

/** Pages of 25 covering at most 100 targets; beyond that the rest refresh on a later read. */
const MAX_REFRESH_PAGES = 4;
/** Refresh a little early, so an image does not expire between this check and the browser's request. */
const EXPIRY_SKEW_SECONDS = 300;

/**
 * Whether a stored CDN URL is past (or nearly past) its signature expiry.
 *
 * A URL with no `oe` parameter is treated as **fresh**, not stale: it is not a signed CDN URL at all
 * (Instagram has changed this parameter before), and assuming staleness would mean a Graph call on
 * every single read.
 */
export function isCdnUrlExpired(url: string | null | undefined): boolean {
  if (!url) return false;
  const match = /[?&]oe=([0-9A-Fa-f]+)/.exec(url);
  if (!match) return false;
  const expiresAt = parseInt(match[1], 16);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt - EXPIRY_SKEW_SECONDS <= Math.floor(Date.now() / 1000);
}

/**
 * Re-fetch and persist thumbnails for this connection's automation targets whose URLs have expired.
 *
 * Returns the media ids that were refreshed. One `fetchMedia` page covers 25 targets at once, which
 * is why this is done as a batch rather than per image.
 */
export async function refreshStaleTargetThumbnails(
  connectionId: string,
  igUserId: string,
): Promise<string[]> {
  const rows = await db.execute<{
    [key: string]: unknown;
    media_id: string;
    thumbnail_url: string | null;
  }>(sql`
    SELECT DISTINCT t.media_id, t.thumbnail_url
    FROM ig_automation_targets t
    JOIN ig_automations a ON a.id = t.automation_id
    WHERE a.connection_id = ${connectionId}::uuid
  `);

  const stale = new Set(
    rows
      .filter((r) => isCdnUrlExpired(r.thumbnail_url))
      .map((r) => String(r.media_id)),
  );
  if (stale.size === 0) return [];

  let token: string;
  try {
    token = await validIgAccessToken(connectionId);
  } catch (error) {
    // A dead token is not this function's problem to report — the caller's own data still renders,
    // just with broken images, which is strictly better than failing the whole request.
    console.warn(
      `[media-freshness] cannot refresh thumbnails: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }

  const refreshed: string[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_REFRESH_PAGES && stale.size > 0; page++) {
    const result = await fetchMedia(igUserId, after, 25, token);
    for (const item of result.items) {
      if (!stale.has(item.id)) continue;
      const url = item.thumbnailUrl ?? item.mediaUrl;
      if (url) {
        await db.execute(sql`
          UPDATE ig_automation_targets SET thumbnail_url = ${url} WHERE media_id = ${item.id}
        `);
        refreshed.push(item.id);
      }
      stale.delete(item.id);
    }
    if (!result.nextCursor) break;
    after = result.nextCursor;
  }

  if (refreshed.length > 0) {
    console.info(`[media-freshness] refreshed ${refreshed.length} target thumbnail(s)`);
  }
  return refreshed;
}

/** Re-fetch and persist the account avatar if its URL has expired. Returns the fresh URL, or null. */
export async function refreshStaleAvatar(
  connectionId: string,
  igUserId: string,
  currentUrl: string | null,
): Promise<string | null> {
  if (!isCdnUrlExpired(currentUrl)) return currentUrl;

  try {
    const token = await validIgAccessToken(connectionId);
    const profile = await fetchProfile(igUserId, token);
    const url = profile?.profilePictureUrl ?? null;
    if (!url) return currentUrl;

    await db.execute(sql`
      UPDATE ig_automation_connections
      SET account_avatar_url = ${url},
          followers_count = COALESCE(${profile?.followersCount ?? null}, followers_count),
          media_count = COALESCE(${profile?.mediaCount ?? null}, media_count),
          last_refreshed_at = now(),
          updated_at = now()
      WHERE id = ${connectionId}::uuid
    `);
    console.info(`[media-freshness] refreshed avatar for @${profile?.username ?? igUserId}`);
    return url;
  } catch (error) {
    console.warn(
      `[media-freshness] avatar refresh failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return currentUrl;
  }
}
