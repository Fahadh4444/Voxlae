import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toIso } from "@/lib/serialize";
import { decryptToken } from "./token-crypto";

/**
 * Connected-account reads and disconnection. Ports the non-OAuth half of `YouTubeAuthController`
 * plus `SocialMediaRefreshTokenService.revokeConnection`.
 */

/** Statuses that need the user to go through consent again. */
const NEEDS_RECONNECT = new Set(["TOKEN_EXPIRED", "ERROR"]);

export interface ConnectedAccountDto {
  platform: string;
  externalAccountId: string;
  accountName: string | null;
  accountAvatarUrl: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  scopes: string[];
  connectionStatus: string | null;
  actionRequired: string | null;
}

interface AccountRow {
  [key: string]: unknown;
  id: string;
  platform_name: string;
  external_account_id: string;
  account_name: string | null;
  account_avatar_url: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  revoked: boolean;
  scopes: string | null;
  connection_status: string | null;
  access_token: string | null;
}

const COLUMNS = sql`
  ca.id, p.platform_name, ca.external_account_id, ca.account_name, ca.account_avatar_url,
  ca.connected_at, ca.last_synced_at, ca.revoked, ca.scopes, ca.connection_status, ca.access_token
`;

function toDto(row: AccountRow): ConnectedAccountDto {
  const status = row.connection_status;
  return {
    platform: row.platform_name,
    externalAccountId: row.external_account_id,
    accountName: row.account_name,
    accountAvatarUrl: row.account_avatar_url,
    connectedAt: toIso(row.connected_at),
    lastSyncedAt: toIso(row.last_synced_at),
    isActive: row.revoked === false && status === "CONNECTED",
    // Stored as a comma-separated string, not an array column.
    scopes: row.scopes ? row.scopes.split(",").filter(Boolean) : [],
    connectionStatus: status,
    actionRequired: status && NEEDS_RECONNECT.has(status) ? "RECONNECT" : null,
  };
}

/**
 * The user's connection for one platform, **including revoked and expired ones**.
 *
 * Deliberately not filtered to live connections: the UI needs to know a dead connection exists so it
 * can offer "reconnect". Hiding it makes the account look never-connected and sends the user through
 * a fresh consent flow that then collides with the existing row.
 */
export async function getConnection(
  userId: number,
  platform: string,
): Promise<ConnectedAccountDto | null> {
  const rows = await db.execute<AccountRow>(sql`
    SELECT ${COLUMNS}
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    WHERE ca.user_id = ${userId} AND p.platform_name = ${platform}
    ORDER BY ca.connected_at DESC
    LIMIT 1
  `);
  return rows[0] ? toDto(rows[0]) : null;
}

/** Every connection the user has, across platforms. */
export async function listConnections(userId: number): Promise<ConnectedAccountDto[]> {
  const rows = await db.execute<AccountRow>(sql`
    SELECT ${COLUMNS}
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    WHERE ca.user_id = ${userId}
    ORDER BY p.platform_name, ca.connected_at DESC
  `);
  return rows.map(toDto);
}

export type DisconnectResult = "disconnected" | "not_connected";

/**
 * Disconnect a platform. Ports `revokeConnection`.
 *
 * **Always succeeds locally, even when Google refuses the revocation.** That ordering is the whole
 * point: if the remote call failing blocked the local disconnect, a user whose token Google had
 * already invalidated could never disconnect — the button would error forever on an account that is
 * already dead.
 *
 * The row is marked revoked rather than deleted, so reconnecting the same channel resumes against the
 * same row instead of colliding with `uq_connected_account_external`.
 */
export async function disconnectPlatform(
  userId: number,
  platform: string,
): Promise<DisconnectResult> {
  const rows = await db.execute<{
    [key: string]: unknown;
    id: string;
    access_token: string | null;
    refresh_token: string | null;
  }>(sql`
    SELECT ca.id, ca.access_token, ca.refresh_token
    FROM connected_accounts ca
    JOIN platforms p ON p.platform_id = ca.platform_id
    WHERE ca.user_id = ${userId} AND p.platform_name = ${platform}
    LIMIT 1
  `);
  const account = rows[0];
  if (!account) return "not_connected";

  if (platform === "YOUTUBE") {
    // Best effort. Google's revoke endpoint accepts either the access or the refresh token, and
    // revoking the refresh token kills the whole grant — which is what "disconnect" should mean.
    let token: string | null = account.access_token;
    try {
      token = decryptToken(account.refresh_token) ?? account.access_token;
    } catch {
      /* fall back to the access token */
    }
    if (token) {
      try {
        const response = await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          { method: "POST", signal: AbortSignal.timeout(5_000) },
        );
        if (!response.ok) {
          console.warn(`[connections] Google revoke returned ${response.status}`);
        }
      } catch (error) {
        console.warn(
          `[connections] revoke at Google failed (continuing): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  await db.execute(sql`
    UPDATE connected_accounts
    SET revoked = true, connection_status = 'DISCONNECTED', access_token = NULL
    WHERE id = ${String(account.id)}::uuid
  `);
  return "disconnected";
}
