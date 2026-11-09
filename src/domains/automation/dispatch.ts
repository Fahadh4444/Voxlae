import { sql } from "drizzle-orm";
import { db } from "@/db";
import { matchesKeywords, type KeywordMatchMode } from "./keyword-matcher";
import { IG_LIMITS, reserve, reservePair, scaled, warmupFactor } from "@/lib/ratelimit";
import { pickVariant, varyReplyText } from "./reply-text";
import { scheduleJitteredSend, type ScheduledSend } from "./send-schedule";

/**
 * Comment-automation decision pipeline. Ported from `AutomationDispatchService.handleComment`
 * and `processDirectReply`.
 *
 * Split deliberately at the point where the decision ends and the network begins: everything
 * here — matching, dedup, opt-out, budget reservation — is decidable from the database and is
 * therefore testable. The actual Graph API sends are separate, so the logic that decides
 * *whether* a creator's account speaks can be verified without a live connected account.
 */

export type DispatchOutcome =
  | "IGNORED_OWN_COMMENT"
  | "IGNORED_NO_MEDIA"
  | "NO_MATCH"
  | "SKIPPED_DUP"
  | "OPTED_OUT"
  | "THROTTLED"
  | "AWAITING_FOLLOW"
  | "SCHEDULED";

export interface CommentEvent {
  commentId: string;
  mediaId: string | null;
  commenterIgsid: string | null;
  commenterUsername: string | null;
  text: string | null;
}

export interface Connection {
  id: string;
  igUserId: string;
  connectedAt: string | null;
}

export interface DispatchDecision {
  outcome: DispatchOutcome;
  executionId?: string;
  automationId?: string;
  sendPublic?: boolean;
  sendDm?: boolean;
  reason?: string;
  /** The send to run after the webhook is acked, when one was decided. */
  send?: ScheduledSend | null;
}

/** A DM to the same recipient inside this window is suppressed, per `DM_RECIPIENT_WINDOW`. */
const DM_RECIPIENT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface AutomationRow extends Record<string, unknown> {
  id: string;
  type: string;
  keyword_match_mode: string;
  keywords: string[] | null;
  public_texts: string[] | null;
  dm_texts: string[] | null;
  dm_link_urls: string[] | null;
  follow_prompt_texts: string[] | null;
}

export async function dispatchComment(
  connection: Connection,
  event: CommentEvent,
): Promise<DispatchDecision> {
  // Never react to the connected account's own comments — that is how a reply loop starts.
  if (event.commenterIgsid && event.commenterIgsid === connection.igUserId) {
    return { outcome: "IGNORED_OWN_COMMENT" };
  }
  if (!event.mediaId) return { outcome: "IGNORED_NO_MEDIA" };

  // Enabled automations for this connection that apply to this media: account-wide (ANY) or
  // explicitly targeting the post. Replies are pulled in the same query to avoid N+1.
  const candidates = await db.execute<AutomationRow>(sql`
    SELECT DISTINCT a.id, a.type, a.keyword_match_mode,
      (SELECT array_agg(k.keyword) FROM ig_automation_keywords k WHERE k.automation_id = a.id) AS keywords,
      (SELECT array_agg(r.variant_text) FROM ig_automation_replies r
         WHERE r.automation_id = a.id AND r.channel = 'PUBLIC') AS public_texts,
      (SELECT array_agg(r.variant_text) FROM ig_automation_replies r
         WHERE r.automation_id = a.id AND r.channel = 'DM') AS dm_texts,
      -- The link and gate copy live on the DM reply row, not on the automation, so they are pulled
      -- here rather than looked up again at send time.
      (SELECT array_agg(r.link_url) FROM ig_automation_replies r
         WHERE r.automation_id = a.id AND r.channel = 'DM' AND r.link_url IS NOT NULL) AS dm_link_urls,
      (SELECT array_agg(r.follow_prompt_text) FROM ig_automation_replies r
         WHERE r.automation_id = a.id AND r.channel = 'DM'
           AND r.follow_prompt_text IS NOT NULL) AS follow_prompt_texts
    FROM ig_automations a
    LEFT JOIN ig_automation_targets t ON t.automation_id = a.id
    WHERE a.connection_id = ${connection.id}::uuid
      AND a.enabled = true
      AND (a.target_mode = 'ANY' OR t.media_id = ${event.mediaId})
    ORDER BY a.id
  `);

  // First match wins, matching `.findFirst()`.
  const matched = candidates.find((a) =>
    matchesKeywords(
      a.keyword_match_mode as KeywordMatchMode,
      a.keywords ?? [],
      event.text,
    ),
  );
  if (!matched) return { outcome: "NO_MATCH" };

  /**
   * Dedup ledger. `uq_ig_automation_execution_comment` is unique on `comment_id` *globally*, so
   * a comment can only ever trigger one execution — across all automations, and across redelivery
   * of the same webhook. Letting the database decide, rather than checking first, makes this
   * correct under concurrent delivery too: Meta retries, and two workers can hold the same event.
   */
  /**
   * Coerce undefined to null before binding. Drizzle *drops* an `undefined` interpolation from a
   * `sql` template rather than binding NULL, which silently shifts every later parameter and
   * produces a syntax error — or, worse, a valid statement with values in the wrong columns.
   * Optional webhook fields (a comment with no username) hit this immediately.
   */
  const nz = <T,>(v: T | undefined | null): T | null => (v === undefined ? null : v);

  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO ig_automation_executions
      (automation_id, connection_id, comment_id, media_id, commenter_igsid, commenter_username,
       comment_text, status)
    VALUES (${matched.id}::uuid, ${connection.id}::uuid, ${event.commentId}, ${nz(event.mediaId)},
            ${nz(event.commenterIgsid)}, ${nz(event.commenterUsername)}, ${nz(event.text)}, 'MATCHED')
    ON CONFLICT (comment_id) DO NOTHING
    RETURNING id
  `);
  const executionId = inserted[0]?.id;
  if (!executionId) return { outcome: "SKIPPED_DUP", automationId: matched.id };

  if (event.commenterIgsid) {
    const opted = await db.execute<{ n: string }>(sql`
      SELECT count(*) AS n FROM ig_automation_optouts
      WHERE connection_id = ${connection.id}::uuid AND commenter_igsid = ${event.commenterIgsid}
    `);
    if (Number(opted[0]?.n ?? 0) > 0) {
      await setStatus(executionId, "OPTED_OUT");
      return { outcome: "OPTED_OUT", executionId, automationId: matched.id };
    }
  }

  const ramp = warmupFactor(connection.connectedAt);

  /**
   * Follow-gated automations prompt first and deliver only after the follow is verified.
   *
   * The prompt is an outbound message, so it consumes DM budget and the 24h per-recipient cap just
   * like a normal DM — skipping that accounting would let a follow-gated automation send unlimited
   * prompts while a plain one is capped.
   */
  if (matched.type === "KEYWORD_REPLY_FOLLOW_GATED") {
    const sendPrompt =
      Boolean(event.commenterIgsid) &&
      !(await recentDmToRecipient(connection.id, event.commenterIgsid as string)) &&
      (await reserveDmBudget(connection.igUserId, ramp));
    if (!sendPrompt) {
      await setStatus(
        executionId,
        "THROTTLED",
        "Skipped by account-safety guardrail (volume cap or 24h per-recipient DM limit)",
      );
      return { outcome: "THROTTLED", executionId, automationId: matched.id };
    }

    const gatePublic =
      Boolean(matched.public_texts?.some((t) => t?.trim())) &&
      (await reservePublicBudget(connection.igUserId, event.mediaId, ramp));

    const send = scheduleJitteredSend({
      executionId,
      connectionId: connection.id,
      commentId: event.commentId,
      mediaId: event.mediaId,
      commenterIgsid: event.commenterIgsid,
      sendPublic: gatePublic,
      sendDm: true,
      publicText: gatePublic
        ? await varyReplyText(event.mediaId, pickVariant(matched.public_texts))
        : null,
      // For a gated automation the DM slot carries the *prompt*, not the payload.
      dmText: matched.follow_prompt_texts?.[0] ?? null,
      dmLinkUrl: null,
      followGate: true,
    });
    return {
      outcome: "AWAITING_FOLLOW",
      executionId,
      automationId: matched.id,
      sendPublic: gatePublic,
      sendDm: true,
      send,
    };
  }

  const wantPublic = Boolean(matched.public_texts?.some((t) => t?.trim()));
  const wantDm = Boolean(matched.dm_texts?.some((t) => t?.trim()));

  // Public replies consume two caps at once, reserved all-or-nothing so a full per-media cap
  // cannot burn per-account budget that never sent anything.
  let sendPublic = false;
  if (wantPublic) {
    const result = await reservePair(
      {
        bucket: IG_LIMITS.publicPerAccountHour.bucket,
        key: connection.igUserId,
        limit: scaled(IG_LIMITS.publicPerAccountHour.limit, ramp),
        windowMs: IG_LIMITS.publicPerAccountHour.windowMs,
      },
      {
        bucket: IG_LIMITS.publicPerMediaHour.bucket,
        key: `${connection.igUserId}|${event.mediaId}`,
        limit: scaled(IG_LIMITS.publicPerMediaHour.limit, ramp),
        windowMs: IG_LIMITS.publicPerMediaHour.windowMs,
      },
    );
    sendPublic = result.allowed;
  }

  let sendDm = false;
  if (wantDm && event.commenterIgsid) {
    const recent = await recentDmToRecipient(connection.id, event.commenterIgsid);
    if (!recent) {
      const hour = await reserve(
        IG_LIMITS.dmPerAccountHour.bucket,
        connection.igUserId,
        scaled(IG_LIMITS.dmPerAccountHour.limit, ramp),
        IG_LIMITS.dmPerAccountHour.windowMs,
      );
      if (hour.allowed) {
        const day = await reserve(
          IG_LIMITS.dmPerAccountDay.bucket,
          connection.igUserId,
          scaled(IG_LIMITS.dmPerAccountDay.limit, ramp),
          IG_LIMITS.dmPerAccountDay.windowMs,
        );
        sendDm = day.allowed;
      }
    }
  }

  if (!sendPublic && !sendDm) {
    await setStatus(
      executionId,
      "THROTTLED",
      "Skipped by account-safety guardrail (volume cap or 24h per-recipient DM limit)",
    );
    return { outcome: "THROTTLED", executionId, automationId: matched.id };
  }

  const send = scheduleJitteredSend({
    executionId,
    connectionId: connection.id,
    commentId: event.commentId,
    mediaId: event.mediaId,
    commenterIgsid: event.commenterIgsid,
    sendPublic,
    sendDm,
    // Variant selection happens here, not at send time, so the reply text is fixed at the moment the
    // budget was reserved — a retried or delayed send says exactly what was decided.
    publicText: sendPublic
      ? await varyReplyText(event.mediaId, pickVariant(matched.public_texts))
      : null,
    dmText: sendDm ? pickVariant(matched.dm_texts) : null,
    dmLinkUrl: sendDm ? (matched.dm_link_urls?.[0] ?? null) : null,
    followGate: false,
  });

  return {
    outcome: "SCHEDULED",
    executionId,
    automationId: matched.id,
    sendPublic,
    sendDm,
    send,
  };
}

/** One DM slot from both the hourly and daily caps. Both must allow it. */
async function reserveDmBudget(igUserId: string, ramp: number): Promise<boolean> {
  const hour = await reserve(
    IG_LIMITS.dmPerAccountHour.bucket,
    igUserId,
    scaled(IG_LIMITS.dmPerAccountHour.limit, ramp),
    IG_LIMITS.dmPerAccountHour.windowMs,
  );
  if (!hour.allowed) return false;
  const day = await reserve(
    IG_LIMITS.dmPerAccountDay.bucket,
    igUserId,
    scaled(IG_LIMITS.dmPerAccountDay.limit, ramp),
    IG_LIMITS.dmPerAccountDay.windowMs,
  );
  return day.allowed;
}

/** Per-account and per-media public-reply caps, reserved all-or-nothing. */
async function reservePublicBudget(
  igUserId: string,
  mediaId: string | null,
  ramp: number,
): Promise<boolean> {
  const result = await reservePair(
    {
      bucket: IG_LIMITS.publicPerAccountHour.bucket,
      key: igUserId,
      limit: scaled(IG_LIMITS.publicPerAccountHour.limit, ramp),
      windowMs: IG_LIMITS.publicPerAccountHour.windowMs,
    },
    {
      bucket: IG_LIMITS.publicPerMediaHour.bucket,
      key: `${igUserId}|${mediaId}`,
      limit: scaled(IG_LIMITS.publicPerMediaHour.limit, ramp),
      windowMs: IG_LIMITS.publicPerMediaHour.windowMs,
    },
  );
  return result.allowed;
}

/** Has a DM already gone to this recipient inside the 24h window? */
async function recentDmToRecipient(
  connectionId: string,
  commenterIgsid: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DM_RECIPIENT_WINDOW_MS).toISOString();
  const rows = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM ig_automation_executions
    WHERE connection_id = ${connectionId}::uuid
      AND commenter_igsid = ${commenterIgsid}
      AND dm_sent = true
      AND created_at >= ${since}
  `);
  return Number(rows[0]?.n ?? 0) > 0;
}

async function setStatus(
  executionId: string,
  status: string,
  error?: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE ig_automation_executions
    SET status = ${status}, error = ${error ?? null}, updated_at = now()
    WHERE id = ${executionId}::uuid
  `);
}

/**
 * Messaging events: STOP opt-out capture.
 *
 * Ported from `AutomationDispatchService.handleMessaging`. A follow-gate tap is reported as
 * `FOLLOW_VERIFY_TAP` and acted on by `webhook-router.ts`, which holds the connection context the
 * follow check and unlock DM both need.
 *
 * Opting out is the one part of this engine a recipient controls, so it is deliberately the
 * cheapest path: an exact, case-insensitive match on a small keyword set, recorded immediately.
 */
const STOP_KEYWORDS = new Set(["stop", "unsubscribe", "stop all", "opt out"]);

export type MessagingOutcome =
  | "IGNORED_OWN_ECHO"
  | "IGNORED_NO_SENDER"
  | "FOLLOW_VERIFY_TAP"
  | "OPTED_OUT"
  | "NO_ACTION";

export interface MessagingEvent {
  senderIgsid?: string | null;
  text?: string | null;
  postbackPayload?: string | null;
  quickReplyPayload?: string | null;
}

export async function handleMessagingEvent(
  connection: Connection,
  event: MessagingEvent,
): Promise<{ outcome: MessagingOutcome }> {
  const sender = event.senderIgsid;
  if (!sender) return { outcome: "IGNORED_NO_SENDER" };
  // Our own message echoes come back through the same webhook.
  if (sender === connection.igUserId) return { outcome: "IGNORED_OWN_ECHO" };

  const payload = event.postbackPayload ?? event.quickReplyPayload;
  // Handled by the router, which can send; see `follow-gate.ts`.
  if (payload && isFollowVerifyPayload(payload)) {
    return { outcome: "FOLLOW_VERIFY_TAP" };
  }

  if (event.text && STOP_KEYWORDS.has(event.text.trim().toLowerCase())) {
    await db.execute(sql`
      INSERT INTO ig_automation_optouts (connection_id, commenter_igsid)
      VALUES (${connection.id}::uuid, ${sender})
      ON CONFLICT (connection_id, commenter_igsid) DO NOTHING
    `);
    return { outcome: "OPTED_OUT" };
  }

  return { outcome: "NO_ACTION" };
}

/**
 * Matches `FollowVerificationService.isVerifyPayload`. The colon is part of the prefix —
 * without it this would also match unrelated payloads beginning "VERIFY_FOLLOWED" or similar.
 */
const VERIFY_PREFIX = "VERIFY_FOLLOW:";

function isFollowVerifyPayload(payload: string): boolean {
  return payload.startsWith(VERIFY_PREFIX);
}
