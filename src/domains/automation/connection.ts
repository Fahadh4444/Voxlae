import { sql } from "drizzle-orm";
import { refreshStaleAvatar } from "./media-freshness";
import { db } from "@/db";
import { toIso } from "@/lib/serialize";

/**
 * Instagram automation connection status. Ports the DB-backed half of
 * `InstagramAutomationAuthController` (`/status`, `/disconnect`).
 *
 * The full `/api/instagram/dashboard` is not here: it aggregates Graph API insights (KPIs, time
 * series, per-format stats, post rows) rather than reading the database, so it needs a live
 * connected account to verify.
 */

export interface AutomationConnection {
  igUserId: string;
  username: string | null;
  accountAvatarUrl: string | null;
  active: boolean;
  status: string;
  webhookSubscribed: boolean;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  scopes: string[];
  followersCount: number | null;
  mediaCount: number | null;
}

export async function getConnection(
  userId: number,
): Promise<AutomationConnection | null> {
  const rows = await db.execute<{
    id: string;
    ig_user_id: string;
    username: string | null;
    account_avatar_url: string | null;
    status: string;
    webhook_subscribed: boolean;
    connected_at: string | null;
    last_refreshed_at: string | null;
    scopes: string | null;
    followers_count: number | null;
    media_count: number | null;
  }>(sql`
    SELECT id, ig_user_id, username, account_avatar_url, status, webhook_subscribed,
           connected_at, last_refreshed_at, scopes, followers_count, media_count
    FROM ig_automation_connections
    WHERE user_id = ${userId}
    ORDER BY connected_at DESC
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;

  const avatarUrl =
    row.status === "CONNECTED"
      ? await refreshStaleAvatar(String(row.id), row.ig_user_id, row.account_avatar_url)
      : row.account_avatar_url;

  return {
    igUserId: row.ig_user_id,
    username: row.username,
    // Refreshed when its signature has expired; see `media-freshness.ts`. A stale avatar URL 403s at
    // the CDN, which showed up as a missing profile photo with nothing logged anywhere.
    accountAvatarUrl: avatarUrl,
    active: row.status === "CONNECTED",
    status: row.status,
    webhookSubscribed: row.webhook_subscribed,
    connectedAt: toIso(row.connected_at),
    lastRefreshedAt: toIso(row.last_refreshed_at),
    // Stored comma-separated, matching how the Java splits it.
    scopes: row.scopes ? row.scopes.split(",").map((s) => s.trim()).filter(Boolean) : [],
    followersCount: row.followers_count == null ? null : Number(row.followers_count),
    mediaCount: row.media_count == null ? null : Number(row.media_count),
  };
}

/**
 * Soft disconnect, matching `IgAutomationConnection.markDisconnected()`.
 *
 * Deliberately *not* a delete: automations, keywords, targets, replies and the execution history
 * all cascade from this row, so removing it would destroy a creator's entire configuration and
 * audit trail. Reconnecting the same account then resumes cleanly. The access token is cleared
 * and the webhook subscription flag reset, so nothing keeps running against a revoked grant.
 */
export async function disconnect(userId: number): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(sql`
    UPDATE ig_automation_connections
    SET status = 'DISCONNECTED', access_token = NULL, webhook_subscribed = false, updated_at = now()
    WHERE user_id = ${userId} AND status <> 'DISCONNECTED'
    RETURNING id
  `);
  return Boolean(rows[0]);
}

/**
 * Soft-disconnect by Instagram-scoped account id, for Meta's Deauthorize Callback.
 *
 * Keyed on `ig_user_id` rather than `user_id` because the callback identifies the *Instagram*
 * account, not a Voxlae user — Meta has no idea who our users are.
 *
 * Returns whether a connection was found. A miss is normal, not an error: the user may have already
 * disconnected in Voxlae before removing the app on Meta's side.
 */
export async function disconnectByIgUserId(igUserId: string): Promise<boolean> {
  const rows = await db.execute<{ [key: string]: unknown; id: string }>(sql`
    UPDATE ig_automation_connections
    SET status = 'DISCONNECTED', access_token = NULL, webhook_subscribed = false, updated_at = now()
    WHERE ig_user_id = ${igUserId} AND status <> 'DISCONNECTED'
    RETURNING id
  `);
  return Boolean(rows[0]);
}

/**
 * Hard-delete the connection and everything cascaded from it, for Meta's Data Deletion Request
 * Callback. Ports `deleteConnectionAndData`.
 *
 * Distinct from `disconnect` on purpose, and the distinction is the whole point of having two
 * callbacks: deauthorize means "no longer authorised" and must be reversible, while this means
 * "delete my data" and must not be. Automations, keywords, targets, replies, executions and opt-outs
 * all cascade from this row, so removing it removes them.
 */
export async function deleteConnectionAndData(igUserId: string): Promise<boolean> {
  const rows = await db.execute<{ [key: string]: unknown; id: string }>(sql`
    DELETE FROM ig_automation_connections WHERE ig_user_id = ${igUserId}
    RETURNING id
  `);
  if (rows[0]) {
    console.info(
      `[automation] deleted Instagram connection ${rows[0].id} and all cascaded automation data`,
    );
  }
  return Boolean(rows[0]);
}
