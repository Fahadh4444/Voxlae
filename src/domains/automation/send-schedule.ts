/**
 * Jittered outbound sends. Replaces `DelayedSendScheduler`.
 *
 * The jitter exists for a specific reason: replies and DMs firing in an instant burst is a
 * bot-pattern signal, so sends are staggered across a post's comments. The dispatcher does all
 * matching, dedup, opt-out and budget reservation synchronously; only the API call is deferred.
 *
 * **Held in memory, like Spring — not in a queue table.** The webhook runs these inside `after()`,
 * which keeps the invocation alive until every send finishes, so a 4–25s wait is safe. What is not
 * covered, exactly as in Spring: an instance that dies *during* the wait loses that send, and its
 * execution stays MATCHED. Everything before the send is covered by Meta's redelivery instead — see
 * the webhook route.
 */

const MIN_DELAY_MS = 4_000;
const MAX_DELAY_MS = 25_000;

export interface SendJob {
  executionId: string;
  connectionId: string;
  commentId: string;
  mediaId: string | null;
  commenterIgsid: string | null;
  sendPublic: boolean;
  sendDm: boolean;
  publicText: string | null;
  dmText: string | null;
  dmLinkUrl: string | null;
  /**
   * Follow-gated: the DM slot carries the gate *prompt* and the job parks on AWAITING_FOLLOW rather
   * than completing. Carried on the job so the worker does not have to re-read the automation to
   * learn which kind of send this is.
   */
  followGate: boolean;
}

/** A send decided by the dispatcher, due at `runAfter` (epoch ms). */
export interface ScheduledSend {
  job: SendJob;
  runAfter: number;
}

/** Pick a random 4–25s due time for `job`. Nothing is sent or stored here. */
export function scheduleJitteredSend(job: SendJob): ScheduledSend {
  const delay =
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  return { job, runAfter: Date.now() + delay };
}
