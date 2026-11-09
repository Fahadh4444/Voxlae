import { validIgAccessToken } from "@/domains/platform/ensure-token";
import { reserve } from "@/lib/ratelimit";
import {
  GraphSendError,
  replyToComment,
  sendButtonMessage,
  sendDirectMessage,
  sendPrivateReply,
} from "./graph-client";

/**
 * The outbound automation actions. Ports `InstagramReplyService`.
 *
 * Two layers sit in front of every Graph call:
 *
 *  1. **A per-account API throttle** (`AutomationRateLimiter` in the Java), separate from the
 *     volume caps in `AutomationSendGuard`. The caps decide *whether* an account may send; this
 *     decides *how fast*, so a burst of comments on one post does not hit Meta's per-app limit.
 *  2. **Retry with exponential backoff, for rate limiting only.** A 429 is transient; a permissions
 *     error is not, and retrying it three times just wastes the function's execution budget before
 *     failing identically.
 */

const MAX_ATTEMPTS = 3;

/**
 * Meta's own ceiling is roughly 200 calls/hour per account. 100 leaves room for the dashboard's
 * reads on the same account, which draw from the same budget.
 */
const API_CALLS_PER_HOUR = 100;

export class SendThrottledError extends Error {
  constructor(igUserId: string) {
    super(`Instagram API call budget exhausted for account ${igUserId}`);
    this.name = "SendThrottledError";
  }
}

/**
 * Take one slot from the account's hourly API budget.
 *
 * Durable rather than in-process: the Java held a semaphore in a `ConcurrentHashMap`, which a
 * serverless cold start resets to full — and these counters are what keep an account inside Meta's
 * thresholds, so losing them throttles real accounts rather than merely missing a cache.
 */
async function acquire(igUserId: string): Promise<void> {
  const quota = await reserve("ig-api", igUserId, API_CALLS_PER_HOUR, 60 * 60 * 1000);
  if (!quota.allowed) throw new SendThrottledError(igUserId);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(
  igUserId: string,
  action: () => Promise<void>,
  label: string,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await acquire(igUserId);
    try {
      await action();
      return;
    } catch (error) {
      const retryable = error instanceof GraphSendError && error.rateLimited;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw error;
      // 2s then 4s. Short on purpose: this runs inside a queue-drain invocation with its own
      // execution cap, and a job that outlives it is worse than one that fails and is visible.
      const backoff = 2 ** attempt * 1000;
      console.warn(
        `[ig-send] rate limited on ${label} (attempt ${attempt}/${MAX_ATTEMPTS}), waiting ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }
}

export interface SendContext {
  connectionId: string;
  igUserId: string;
}

/** Public reply beneath the comment. */
export async function sendPublicReplyAction(
  ctx: SendContext,
  commentId: string,
  text: string,
): Promise<void> {
  const token = await validIgAccessToken(ctx.connectionId);
  await withRetry(ctx.igUserId, () => replyToComment(commentId, text, token), "public reply");
}

/** Private reply (DM) authorised by the comment itself. */
export async function sendPrivateReplyAction(
  ctx: SendContext,
  commentId: string,
  text: string,
): Promise<void> {
  const token = await validIgAccessToken(ctx.connectionId);
  await withRetry(
    ctx.igUserId,
    () => sendPrivateReply(ctx.igUserId, commentId, text, token),
    "private reply",
  );
}

/** DM to a known IGSID — the follow-gate unlock. */
export async function sendDirectMessageAction(
  ctx: SendContext,
  recipientIgsid: string,
  text: string,
): Promise<void> {
  const token = await validIgAccessToken(ctx.connectionId);
  await withRetry(
    ctx.igUserId,
    () => sendDirectMessage(ctx.igUserId, recipientIgsid, text, token),
    "direct message",
  );
}

export const VERIFY_PREFIX = "VERIFY_FOLLOW:";
const VERIFY_BUTTON_TITLE = "I'm following ✅";

/** Follow-gate step one: a private reply carrying the Verify button, addressed by comment id. */
export async function sendFollowGatePrompt(
  ctx: SendContext,
  commentId: string,
  promptText: string,
  executionId: string,
): Promise<void> {
  const token = await validIgAccessToken(ctx.connectionId);
  await withRetry(
    ctx.igUserId,
    () =>
      sendButtonMessage(
        ctx.igUserId,
        { comment_id: commentId },
        promptText,
        VERIFY_BUTTON_TITLE,
        VERIFY_PREFIX + executionId,
        token,
      ),
    "follow-gate prompt",
  );
}

/** Follow-gate re-prompt, addressed by IGSID once the conversation exists. */
export async function sendFollowGateRetry(
  ctx: SendContext,
  recipientIgsid: string,
  promptText: string,
  executionId: string,
): Promise<void> {
  const token = await validIgAccessToken(ctx.connectionId);
  await withRetry(
    ctx.igUserId,
    () =>
      sendButtonMessage(
        ctx.igUserId,
        { id: recipientIgsid },
        promptText,
        VERIFY_BUTTON_TITLE,
        VERIFY_PREFIX + executionId,
        token,
      ),
    "follow-gate retry",
  );
}
