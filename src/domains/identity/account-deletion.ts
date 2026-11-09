import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Permanent account deletion. Ports `AccountDeletionService`.
 *
 * Most of the user's data is removed by `ON DELETE CASCADE` on `users`, so deleting the row does the
 * bulk of the work. What needs explicit handling is everything *not* keyed by `user_id`:
 *
 *  - **YouTube analytics** is keyed by `channel_id`, which comes from the connected account's
 *    `external_account_id`. Those channel ids have to be collected *before* the user row goes, or
 *    the rows become unreachable orphans.
 *  - **`otp_codes`** is keyed by email address, with no foreign key at all. Leaving these behind
 *    keeps the user's email on record after a request to delete everything — which for a
 *    Meta-initiated data-deletion callback is the difference between complying and not.
 *  - **`user_platform`** is a join table whose JPA mapping had no cascade REMOVE.
 *
 * Everything runs in one transaction, so a failure anywhere leaves the account intact rather than
 * half-deleted. A half-deleted account is the genuinely bad outcome: the user still appears to exist
 * but their data is inconsistent, and there is no path that either completes or undoes it.
 */

export interface DeletionResult {
  userId: number;
  email: string | null;
  youtubeChannels: number;
}

export async function deleteAccount(userId: number): Promise<DeletionResult | null> {
  const users = await db.execute<{ [key: string]: unknown; email: string | null }>(sql`
    SELECT email FROM users WHERE user_id = ${userId}
  `);
  if (!users[0]) return null;
  const email = users[0].email;

  return db.transaction(async (tx) => {
    // Collected first, for the reason above: after the user row is gone there is nothing left to
    // join through to find these channel ids.
    const channels = await tx.execute<{ [key: string]: unknown; external_account_id: string }>(sql`
      SELECT ca.external_account_id
      FROM connected_accounts ca
      JOIN platforms p ON p.platform_id = ca.platform_id
      WHERE ca.user_id = ${userId} AND p.platform_name = 'YOUTUBE'
    `);
    const channelIds = channels.map((c) => String(c.external_account_id));

    if (channelIds.length > 0) {
      // Deepest first — these are FK'd to each other, so the reverse order would be rejected.
      // Drizzle's `= ANY(${array})` does not bind a JS array to a Postgres array, so an IN list
      // built from the ids is used instead.
      const ids = sql.join(
        channelIds.map((id) => sql`${id}`),
        sql`, `,
      );
      await tx.execute(sql`
        DELETE FROM youtube_video_daily_metrics
        WHERE video_id IN (SELECT video_id FROM youtube_videos WHERE channel_id IN (${ids}))
      `);
      await tx.execute(sql`DELETE FROM youtube_videos WHERE channel_id IN (${ids})`);
      // `youtube_channel_daily_metrics` is deliberately absent: V28 dropped it when Performance
      // Trends moved to `platform_daily_snapshot`. A delete against it threw, so **no user with a
      // connected YouTube channel could be deleted at all** — invisible in testing because the whole
      // block is skipped for a user with no channels, which every test user was.
      await tx.execute(sql`DELETE FROM youtube_channels WHERE channel_id IN (${ids})`);
    }

    // These two do cascade from `users`, but are deleted explicitly anyway so the transaction fails
    // loudly here rather than relying on a cascade that a future migration might drop.
    await tx.execute(sql`DELETE FROM platform_daily_snapshot WHERE user_id = ${userId}`);
    /**
     * `user_metrics_snapshot_records` exists in a database built from the migrations but **not in
     * production** — another Hibernate-vs-Flyway divergence (see docs/SCHEMA-DRIFT.md). Deleting from
     * a missing table throws, and this line runs for every user, so account deletion was broken for
     * everyone against the live database while passing every local test.
     *
     * `to_regclass` returns NULL for a table that does not exist, so this is a no-op there and a
     * normal delete where it does. Preferred over removing the line, because the table still exists
     * in some environments and orphaning its rows is what this function is meant to prevent.
     */
    const [snapshotTable] = await tx.execute<{ [key: string]: unknown; present: boolean }>(sql`
      SELECT to_regclass('public.user_metrics_snapshot_records') IS NOT NULL AS present
    `);
    if (snapshotTable?.present) {
      await tx.execute(sql`
        DELETE FROM user_metrics_snapshot_records WHERE user_id = ${userId}
      `);
    }

    // Email-keyed, every type (EMAIL, PHONE, PASSWORD_RESET). No FK, so nothing else removes it.
    if (email) {
      await tx.execute(sql`DELETE FROM otp_codes WHERE lower(identifier) = lower(${email})`);
    }

    await tx.execute(sql`DELETE FROM user_platform WHERE user_id = ${userId}`);

    /**
     * These three do NOT cascade in the live database, whatever the migrations say.
     *
     * `db/migration/` declares `ON DELETE CASCADE` on all of them, and a database built from those
     * migrations behaves that way — but production's foreign keys were created by Hibernate with NO
     * ACTION, because Spring deleted the children itself in Java. Relying on the cascade there does
     * not silently skip the rows; it aborts the whole delete with a foreign-key violation, so the
     * account cannot be deleted at all. Verified against the live schema. See docs/SCHEMA-DRIFT.md.
     */
    await tx.execute(sql`DELETE FROM jwt_refresh_tokens WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM connected_accounts WHERE user_id = ${userId}`);

    // Cascades (in both schemas) to user_roles, the freelancer/brand/creator profiles and their
    // children, and ig_automation_connections with its automations.
    await tx.execute(sql`DELETE FROM users WHERE user_id = ${userId}`);

    return { userId, email, youtubeChannels: channelIds.length };
  });
}
