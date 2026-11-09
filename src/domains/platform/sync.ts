import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toIso } from "@/lib/serialize";
import { NoChannelError, syncChannelData, YouTubeApiError } from "./youtube-data";

/**
 * On-demand platform sync. Ports `PlatformSyncController`'s service half.
 *
 * Every one of these is idempotent and safe to call repeatedly — they were designed as the manual
 * equivalent of the scheduled jobs, which is why they survived the cron removal unchanged. A sync is
 * "refresh what we have stored from the platform", never "create something".
 */

export interface PlatformSyncResult {
  success: boolean;
  platform: string;
  connectionStatus: string | null;
  error: string | null;
  message: string;
  actionRequired: string | null;
  syncedCount: number | null;
}

export interface PlatformStatus {
  platform: string;
  connectionStatus: string | null;
  lastSyncedAt: string | null;
  actionRequired: string | null;
}

const NEEDS_RECONNECT = new Set(["TOKEN_EXPIRED", "ERROR"]);

function tokenExpired(platform: string): PlatformSyncResult {
  return {
    success: false,
    platform,
    connectionStatus: "TOKEN_EXPIRED",
    error: "TOKEN_EXPIRED",
    message: `Your ${platform} connection expired. Please reconnect.`,
    actionRequired: "RECONNECT",
    syncedCount: null,
  };
}

function failure(platform: string, error: string, message: string): PlatformSyncResult {
  return {
    success: false,
    platform,
    connectionStatus: null,
    error,
    message,
    actionRequired: null,
    syncedCount: null,
  };
}

function succeeded(platform: string, count: number, message: string): PlatformSyncResult {
  return {
    success: true,
    platform,
    connectionStatus: "CONNECTED",
    error: null,
    message,
    actionRequired: null,
    syncedCount: count,
  };
}

interface AccountRow {
  [key: string]: unknown;
  id: string;
  platform_name: string;
  connection_status: string | null;
  revoked: boolean;
  last_synced_at: string | null;
}

/**
 * Every platform this user has, from **whichever table actually owns it**.
 *
 * YouTube lives in `connected_accounts`. **Instagram does not** — V40 moved it to
 * `ig_automation_connections` and its own migration note calls the leftover `connected_accounts`
 * rows inert. Reading Instagram from `connected_accounts` reported it **DISCONNECTED while the
 * automations were running fine**, and made `sync-all` answer "some platforms require attention" on
 * a perfectly healthy account.
 *
 * The inert rows are excluded rather than deleted, because V40 deliberately left that shared table
 * alone and something else may still reference them.
 */
async function accounts(userId: number): Promise<AccountRow[]> {
  const [youtube, instagram] = await Promise.all([
    db.execute<AccountRow>(sql`
      SELECT ca.id, p.platform_name, ca.connection_status, ca.revoked, ca.last_synced_at
      FROM connected_accounts ca
      JOIN platforms p ON p.platform_id = ca.platform_id
      WHERE ca.user_id = ${userId} AND p.platform_name <> 'INSTAGRAM'
      ORDER BY p.platform_name
    `),
    db.execute<AccountRow>(sql`
      SELECT id, 'INSTAGRAM' AS platform_name, status AS connection_status,
             (status <> 'CONNECTED') AS revoked, last_refreshed_at AS last_synced_at
      FROM ig_automation_connections
      WHERE user_id = ${userId}
      ORDER BY connected_at DESC LIMIT 1
    `),
  ]);
  return [...youtube, ...instagram].sort((a, b) =>
    a.platform_name.localeCompare(b.platform_name),
  );
}

/**
 * Sync one already-loaded account.
 *
 * A dead connection short-circuits before any API call: firing a request with an expired token wastes
 * a round trip to learn what the stored status already says, and returns a less useful message than
 * "reconnect".
 */
async function syncAccount(userId: number, account: AccountRow): Promise<PlatformSyncResult> {
  const platform = account.platform_name;

  if (account.connection_status === "TOKEN_EXPIRED") return tokenExpired(platform);
  if (account.connection_status === "DISCONNECTED" || account.revoked) {
    return failure(platform, "DISCONNECTED", "Account is disconnected");
  }

  try {
    if (platform === "YOUTUBE") {
      const channel = await syncChannelData(userId);
      return succeeded(platform, 1, `YouTube channel synced: ${channel.title ?? channel.channelId}`);
    }
    if (platform === "INSTAGRAM") {
      // Refreshes the profile counts the platform card and the snapshot capture both read. The Java
      // returned a bare success here without doing anything, which made "sync" a no-op for Instagram.
      const { refreshConnectionProfile } = await import("@/domains/automation/oauth");
      const refreshed = await refreshConnectionProfile(userId);
      return refreshed
        ? succeeded(platform, 1, "Instagram profile synced")
        : failure(platform, "DISCONNECTED", "Account is disconnected");
    }
    return failure(platform, "UNSUPPORTED", "Platform sync not supported");
  } catch (error) {
    if (error instanceof NoChannelError) {
      return failure(platform, "DISCONNECTED", error.message);
    }
    if (error instanceof YouTubeApiError) {
      // Mark the row so the UI can prompt a reconnect without another failed sync first.
      await db.execute(sql`
        UPDATE connected_accounts SET connection_status = 'ERROR'
        WHERE id = ${String(account.id)}::uuid
      `);
      return failure(platform, "OAUTH_ERROR", error.message);
    }
    console.error(
      `[platform-sync] unexpected error syncing ${platform} for user ${userId}:`,
      error,
    );
    return failure(platform, "SYNC_ERROR", `Failed to sync ${platform}. Please try again.`);
  }
}

/** Sync every connected platform. Partial success is normal and reported per platform. */
export async function syncAllPlatforms(userId: number): Promise<PlatformSyncResult[]> {
  const results: PlatformSyncResult[] = [];
  for (const account of await accounts(userId)) {
    results.push(await syncAccount(userId, account));
  }
  return results;
}

export async function syncOnePlatform(
  userId: number,
  platform: string,
): Promise<PlatformSyncResult | null> {
  const wanted = platform.toUpperCase();
  const account = (await accounts(userId)).find((a) => a.platform_name === wanted);
  return account ? syncAccount(userId, account) : null;
}

export async function platformStatuses(userId: number): Promise<PlatformStatus[]> {
  return (await accounts(userId)).map((a) => ({
    platform: a.platform_name,
    connectionStatus: a.connection_status,
    lastSyncedAt: toIso(a.last_synced_at),
    actionRequired:
      a.connection_status && NEEDS_RECONNECT.has(a.connection_status) ? "RECONNECT" : null,
  }));
}
