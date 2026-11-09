import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dispatchComment, handleMessagingEvent, type Connection } from "./dispatch";
import type { ScheduledSend } from "./send-schedule";
import { handleVerifyTap, isVerifyPayload } from "./follow-gate";

/**
 * Parses a verified Instagram webhook payload and routes each entry. Ports `InstagramWebhookRouter`.
 *
 * Payload shape:
 * ```
 * { "object": "instagram", "entry": [ { "id": "<ig-user-id>", "time": ...,
 *     "changes":   [ { "field": "comments", "value": {...} } ],
 *     "messaging": [ { "sender": {...}, "message": {...} | "postback": {...} } ] } ] }
 * ```
 *
 * **Every event is isolated.** One malformed entry, or one account whose token has died, must not
 * stop the others in the same delivery — Meta batches unrelated events together and will not resend
 * the ones that did succeed.
 */

type Json = Record<string, unknown>;

export interface RouteResult {
  entries: number;
  comments: number;
  messaging: number;
  errors: number;
  /**
   * Events that failed in a way worth another try — a database error mid-dispatch, not a malformed
   * payload. When non-zero the webhook answers 500 so **Meta redelivers**, which is the only retry
   * there is. Redelivery is safe for the events that did succeed: comments stop at the executions
   * unique constraint (`SKIPPED_DUP`), and a resolved follow-gate tap returns `ALREADY_RESOLVED`.
   */
  retryable: number;
  /** Every send this payload decided on. The webhook runs them after acking. */
  sendJobs: ScheduledSend[];
}

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** The active automation connection for an Instagram account id. */
async function connectionFor(igUserId: string): Promise<Connection | null> {
  const rows = await db.execute<{
    [key: string]: unknown;
    id: string;
    ig_user_id: string;
    connected_at: string | null;
  }>(sql`
    SELECT id, ig_user_id, connected_at
    FROM ig_automation_connections
    WHERE ig_user_id = ${igUserId} AND status = 'CONNECTED' AND access_token IS NOT NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    igUserId: String(row.ig_user_id),
    connectedAt: row.connected_at,
  };
}

export async function routeWebhookPayload(rawPayload: string): Promise<RouteResult> {
  const result: RouteResult = {
    entries: 0,
    comments: 0,
    messaging: 0,
    errors: 0,
    retryable: 0,
    sendJobs: [],
  };

  let root: Json;
  try {
    root = JSON.parse(rawPayload) as Json;
  } catch (error) {
    // Signature already verified, so a parse failure means Meta sent something new. Recorded and
    // dropped rather than retried — a payload that will not parse will not parse next time either.
    console.error(
      `[ig-webhook] unparseable payload: ${error instanceof Error ? error.message : String(error)}`,
    );
    result.errors++;
    return result;
  }

  const entries = root.entry;
  if (!Array.isArray(entries)) return result;

  for (const raw of entries) {
    const entry = obj(raw);
    if (!entry) continue;
    result.entries++;

    const igUserId = str(entry.id);
    if (!igUserId) continue;

    const connection = await connectionFor(igUserId);
    if (!connection) {
      // Normal, not an error: a disconnected account whose webhook subscription Meta still honours.
      console.debug(`[ig-webhook] no active connection for IG account ${igUserId} — ignoring`);
      continue;
    }

    // ---- Comment events ----
    if (Array.isArray(entry.changes)) {
      for (const rawChange of entry.changes) {
        const change = obj(rawChange);
        if (!change || change.field !== "comments") continue;
        const value = obj(change.value);
        if (!value) continue;
        const from = obj(value.from);
        const media = obj(value.media);
        try {
          const decision = await dispatchComment(connection, {
            commentId: String(value.id ?? ""),
            mediaId: media ? str(media.id) : null,
            commenterIgsid: from ? str(from.id) : null,
            commenterUsername: from ? str(from.username) : null,
            text: str(value.text),
          });
          result.comments++;
          if (decision.send) result.sendJobs.push(decision.send);
          console.info(
            `[ig-webhook] comment ${value.id} -> ${decision.outcome}${
              decision.executionId ? ` (execution ${decision.executionId})` : ""
            }`,
          );
        } catch (error) {
          result.errors++;
          result.retryable++;
          console.error(
            `[ig-webhook] comment dispatch failed for ${igUserId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    // ---- Messaging events: follow-gate taps and STOP ----
    if (Array.isArray(entry.messaging)) {
      for (const rawEvent of entry.messaging) {
        const event = obj(rawEvent);
        if (!event) continue;
        const sender = obj(event.sender);
        const message = obj(event.message);
        const postback = obj(event.postback);
        const quickReply = message ? obj(message.quick_reply) : null;
        const senderIgsid = sender ? str(sender.id) : null;
        const payload =
          (postback ? str(postback.payload) : null) ??
          (quickReply ? str(quickReply.payload) : null);

        try {
          // The gate tap is handled here rather than inside `dispatchComment`'s messaging branch,
          // because it sends — and everything that sends needs the connection context.
          if (senderIgsid && senderIgsid !== connection.igUserId && isVerifyPayload(payload)) {
            const outcome = await handleVerifyTap(
              { connectionId: connection.id, igUserId: connection.igUserId },
              senderIgsid,
              payload as string,
            );
            result.messaging++;
            console.info(`[ig-webhook] follow-gate tap from ${senderIgsid} -> ${outcome}`);
            continue;
          }

          const { outcome } = await handleMessagingEvent(connection, {
            senderIgsid,
            text: message ? str(message.text) : null,
            postbackPayload: postback ? str(postback.payload) : null,
            quickReplyPayload: quickReply ? str(quickReply.payload) : null,
          });
          result.messaging++;
          if (outcome !== "NO_ACTION" && outcome !== "IGNORED_OWN_ECHO") {
            console.info(`[ig-webhook] messaging event -> ${outcome}`);
          }
        } catch (error) {
          result.errors++;
          result.retryable++;
          console.error(
            `[ig-webhook] messaging dispatch failed for ${igUserId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  }

  return result;
}
