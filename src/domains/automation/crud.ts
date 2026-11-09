import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toIso } from "@/lib/serialize";
import { refreshStaleTargetThumbnails } from "./media-freshness";

/**
 * Automation read + lifecycle operations. Ports the read half of `AutomationService`
 * (`list`, `get`, `stats`) plus `setEnabled` and `delete`.
 *
 * **Ownership is enforced in the query, not after it.** `requireOwned` does
 * `findByIdAndUserUserId`, so an automation belonging to someone else is indistinguishable from
 * one that does not exist. Every function here follows that: `user_id` is part of the WHERE
 * clause, never a check performed on a row already fetched. Fetch-then-compare is how an
 * IDOR slips in when someone later edits the code and drops the comparison.
 */

export interface AutomationSummary {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  targetMode: string;
  includeFuturePosts: boolean;
  keywordMatchMode: string;
  keywords: string[];
  publicReplies: string[];
  dmReplies: { text: string; linkUrl: string | null }[];
  targets: { mediaId: string; permalink: string | null; thumbnailUrl: string | null; caption: string | null }[];
  triggeredCount: number;
  dmSentCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  target_mode: string;
  include_future_posts: boolean;
  keyword_match_mode: string;
  created_at: string | null;
  updated_at: string | null;
  keywords: string[] | null;
  public_replies: string[] | null;
  triggered_count: string;
  dm_sent_count: string;
}

/**
 * Shared projection. Counts and child collections are computed as scalar subqueries rather than
 * joins so a single automation cannot be multiplied across its keywords × replies × targets.
 */
const SELECT_AUTOMATION = sql`
  SELECT a.id, a.name, a.type, a.enabled, a.target_mode, a.include_future_posts,
         a.keyword_match_mode, a.created_at, a.updated_at,
    (SELECT array_agg(k.keyword ORDER BY k.keyword)
       FROM ig_automation_keywords k WHERE k.automation_id = a.id) AS keywords,
    (SELECT array_agg(r.variant_text ORDER BY r.variant_order)
       FROM ig_automation_replies r WHERE r.automation_id = a.id AND r.channel = 'PUBLIC') AS public_replies,
    (SELECT count(*) FROM ig_automation_executions e WHERE e.automation_id = a.id) AS triggered_count,
    (SELECT count(*) FROM ig_automation_executions e WHERE e.automation_id = a.id AND e.dm_sent) AS dm_sent_count
  FROM ig_automations a
`;

async function hydrate(rows: Row[]): Promise<AutomationSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const idList = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);

  const [dmRows, targetRows] = await Promise.all([
    db.execute<{ automation_id: string; variant_text: string; link_url: string | null }>(sql`
      SELECT automation_id, variant_text, link_url FROM ig_automation_replies
      WHERE automation_id IN (${idList}) AND channel = 'DM' ORDER BY variant_order
    `),
    db.execute<{
      automation_id: string; media_id: string; permalink: string | null;
      thumbnail_url: string | null; caption: string | null;
    }>(sql`
      SELECT automation_id, media_id, permalink, thumbnail_url, caption
      FROM ig_automation_targets WHERE automation_id IN (${idList})
    `),
  ]);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    enabled: r.enabled,
    targetMode: r.target_mode,
    includeFuturePosts: r.include_future_posts,
    keywordMatchMode: r.keyword_match_mode,
    keywords: r.keywords ?? [],
    publicReplies: r.public_replies ?? [],
    dmReplies: dmRows
      .filter((d) => d.automation_id === r.id)
      .map((d) => ({ text: d.variant_text, linkUrl: d.link_url })),
    targets: targetRows
      .filter((t) => t.automation_id === r.id)
      .map((t) => ({
        mediaId: t.media_id,
        permalink: t.permalink,
        thumbnailUrl: t.thumbnail_url,
        caption: t.caption,
      })),
    triggeredCount: Number(r.triggered_count),
    dmSentCount: Number(r.dm_sent_count),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }));
}

export async function listAutomations(userId: number): Promise<AutomationSummary[]> {
  /**
   * Refresh expired post thumbnails first.
   *
   * Instagram CDN URLs are signed and expire in a couple of weeks (see `media-freshness.ts`), so the
   * thumbnails stored when the automation was created eventually 403 and the cards render blank. The
   * check is free when the URLs are still valid — it reads the `oe` parameter rather than calling
   * anything — and costs one batched Graph call when they are not.
   */
  const connection = await db.execute<{ [key: string]: unknown; id: string; ig_user_id: string }>(sql`
    SELECT id, ig_user_id FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED' AND access_token IS NOT NULL
    ORDER BY connected_at DESC LIMIT 1
  `);
  if (connection[0]) {
    await refreshStaleTargetThumbnails(
      String(connection[0].id),
      String(connection[0].ig_user_id),
    );
  }

  const rows = await db.execute<Row>(sql`
    ${SELECT_AUTOMATION} WHERE a.user_id = ${userId} ORDER BY a.created_at DESC
  `);
  return hydrate(rows);
}

/** Null when the automation does not exist **or** belongs to someone else — deliberately same. */
export async function getAutomation(
  userId: number,
  id: string,
): Promise<AutomationSummary | null> {
  const rows = await db.execute<Row>(sql`
    ${SELECT_AUTOMATION} WHERE a.id = ${id}::uuid AND a.user_id = ${userId}
  `);
  return (await hydrate(rows))[0] ?? null;
}

export interface AutomationStats {
  triggered: number;
  publicReplies: number;
  dmSent: number;
  awaitingFollow: number;
  unlocked: number;
  failed: number;
  throttled: number;
  recent: {
    commenterUsername: string | null;
    commentText: string | null;
    status: string;
    followVerified: boolean | null;
    createdAt: string | null;
  }[];
}

export async function getAutomationStats(
  userId: number,
  id: string,
): Promise<AutomationStats | null> {
  // Ownership and existence first: an automation with no executions still exists, and that has
  // to be distinguishable from one that is not yours. Checking up front also means a non-owned id
  // costs a single query instead of three.
  const exists = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM ig_automations WHERE id = ${id}::uuid AND user_id = ${userId}
  `);
  if (Number(exists[0]?.n ?? 0) === 0) return null;

  const totals = await db.execute<Record<string, string>>(sql`
    SELECT
      count(*)                                                   AS triggered,
      count(*) FILTER (WHERE e.public_reply_sent)                AS public_replies,
      count(*) FILTER (WHERE e.dm_sent)                          AS dm_sent,
      count(*) FILTER (WHERE e.status = 'AWAITING_FOLLOW')       AS awaiting_follow,
      count(*) FILTER (WHERE e.status = 'UNLOCKED')              AS unlocked,
      count(*) FILTER (WHERE e.status = 'FAILED')                AS failed,
      count(*) FILTER (WHERE e.status = 'THROTTLED')             AS throttled
    FROM ig_automation_executions e
    JOIN ig_automations a ON a.id = e.automation_id
    WHERE a.id = ${id}::uuid AND a.user_id = ${userId}
  `);

  const recent = await db.execute<{
    commenter_username: string | null; comment_text: string | null;
    status: string; follow_verified: boolean | null; created_at: string | null;
  }>(sql`
    SELECT e.commenter_username, e.comment_text, e.status, e.follow_verified, e.created_at
    FROM ig_automation_executions e
    JOIN ig_automations a ON a.id = e.automation_id
    WHERE a.id = ${id}::uuid AND a.user_id = ${userId}
    ORDER BY e.created_at DESC
    LIMIT 20
  `);

  const t = totals[0] ?? {};
  return {
    triggered: Number(t.triggered ?? 0),
    publicReplies: Number(t.public_replies ?? 0),
    dmSent: Number(t.dm_sent ?? 0),
    awaitingFollow: Number(t.awaiting_follow ?? 0),
    unlocked: Number(t.unlocked ?? 0),
    failed: Number(t.failed ?? 0),
    throttled: Number(t.throttled ?? 0),
    recent: recent.map((r) => ({
      commenterUsername: r.commenter_username,
      commentText: r.comment_text,
      status: r.status,
      followVerified: r.follow_verified,
      createdAt: toIso(r.created_at),
    })),
  };
}

/** Returns the updated automation, or null when not owned. */
export async function setAutomationEnabled(
  userId: number,
  id: string,
  enabled: boolean,
): Promise<AutomationSummary | null> {
  const updated = await db.execute<{ id: string }>(sql`
    UPDATE ig_automations SET enabled = ${enabled}, updated_at = now()
    WHERE id = ${id}::uuid AND user_id = ${userId}
    RETURNING id
  `);
  if (!updated[0]) return null;
  return getAutomation(userId, id);
}

/** True when a row was deleted; false when it does not exist or is not owned. */
export async function deleteAutomation(userId: number, id: string): Promise<boolean> {
  const deleted = await db.execute<{ id: string }>(sql`
    DELETE FROM ig_automations WHERE id = ${id}::uuid AND user_id = ${userId} RETURNING id
  `);
  return Boolean(deleted[0]);
}

/* ------------------------------------------------------------------------- */
/* Create / update                                                            */
/* ------------------------------------------------------------------------- */

import {
  validateAutomation,
  ValidationError,
  type AutomationInput,
  type NormalizedAutomation,
} from "./validation";

export { ValidationError };

/** Thrown when the user has no active Instagram connection to attach an automation to. */
export class NoConnectionError extends Error {
  constructor() {
    super("Connect an Instagram account for automations first");
    this.name = "NoConnectionError";
  }
}

/** Matches `requireConnection`: a connection exists **and** is active. */
async function requireConnectionId(userId: number): Promise<string> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED'
    ORDER BY connected_at DESC LIMIT 1
  `);
  const id = rows[0]?.id;
  if (!id) throw new NoConnectionError();
  return id;
}

/**
 * Write the child collections for an automation.
 *
 * Delete-then-insert rather than diffing: these are small, order-carrying lists that the creator
 * edits as a whole in the form, and a diff would have to reconcile reordering — more code and more
 * ways to be subtly wrong for no benefit. Runs inside the caller's transaction so an automation is
 * never left with half its keywords.
 */
async function writeChildren(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  automationId: string,
  data: NormalizedAutomation,
): Promise<void> {
  await tx.execute(sql`DELETE FROM ig_automation_keywords WHERE automation_id = ${automationId}::uuid`);
  await tx.execute(sql`DELETE FROM ig_automation_targets WHERE automation_id = ${automationId}::uuid`);
  await tx.execute(sql`DELETE FROM ig_automation_replies WHERE automation_id = ${automationId}::uuid`);

  for (const keyword of data.keywords) {
    await tx.execute(sql`
      INSERT INTO ig_automation_keywords (automation_id, keyword)
      VALUES (${automationId}::uuid, ${keyword})
    `);
  }
  for (const target of data.targets) {
    await tx.execute(sql`
      INSERT INTO ig_automation_targets (automation_id, media_id)
      VALUES (${automationId}::uuid, ${target.mediaId})
    `);
  }
  let order = 0;
  for (const text of data.publicReplies) {
    await tx.execute(sql`
      INSERT INTO ig_automation_replies (automation_id, channel, variant_order, variant_text)
      VALUES (${automationId}::uuid, 'PUBLIC', ${order++}, ${text})
    `);
  }
  order = 0;
  for (const dm of data.dmReplies) {
    await tx.execute(sql`
      INSERT INTO ig_automation_replies
        (automation_id, channel, variant_order, variant_text, link_url, follow_prompt_text, unlock_text)
      VALUES (${automationId}::uuid, 'DM', ${order++}, ${dm.text ?? ""},
              ${dm.linkUrl ?? null}, ${dm.followPromptText ?? null}, ${dm.unlockText ?? null})
    `);
  }
}

export async function createAutomation(
  userId: number,
  input: AutomationInput,
): Promise<AutomationSummary> {
  const data = validateAutomation(input);
  const connectionId = await requireConnectionId(userId);

  const id = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO ig_automations
        (user_id, connection_id, name, type, enabled, target_mode, include_future_posts,
         keyword_match_mode)
      VALUES (${userId}, ${connectionId}::uuid, ${data.name}, ${data.type}, ${data.enabled},
              ${data.targetMode}, ${data.includeFuturePosts}, ${data.keywordMatchMode})
      RETURNING id
    `);
    const newId = rows[0].id;
    await writeChildren(tx, newId, data);
    return newId;
  });

  const created = await getAutomation(userId, id);
  if (!created) throw new Error("Automation vanished immediately after creation");
  return created;
}

/** Null when the automation does not exist or is not owned — same as `getAutomation`. */
export async function updateAutomation(
  userId: number,
  id: string,
  input: AutomationInput,
): Promise<AutomationSummary | null> {
  const data = validateAutomation(input);

  const updated = await db.transaction(async (tx) => {
    // Ownership in the WHERE clause, as everywhere else here.
    const rows = await tx.execute<{ id: string }>(sql`
      UPDATE ig_automations
      SET name = ${data.name}, type = ${data.type}, enabled = ${data.enabled},
          target_mode = ${data.targetMode}, include_future_posts = ${data.includeFuturePosts},
          keyword_match_mode = ${data.keywordMatchMode}, updated_at = now()
      WHERE id = ${id}::uuid AND user_id = ${userId}
      RETURNING id
    `);
    if (!rows[0]) return false;
    await writeChildren(tx, id, data);
    return true;
  });

  return updated ? getAutomation(userId, id) : null;
}
