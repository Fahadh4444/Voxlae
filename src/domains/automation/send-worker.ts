import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ScheduledSend, SendJob } from "./send-schedule";
import {
  sendFollowGatePrompt,
  sendPrivateReplyAction,
  sendPublicReplyAction,
} from "./reply-service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a webhook's sends, each after its own jitter. Called from `after()` in the webhook route, once
 * Meta already has its 200.
 *
 * Each send waits independently, so a payload with several comments does not make the later ones
 * wait for the earlier ones. Never throws: a send that cannot run is recorded on its execution as
 * FAILED rather than left looking MATCHED forever.
 */
export async function runScheduledSends(sends: ScheduledSend[]): Promise<void> {
  await Promise.all(
    sends.map(async ({ job, runAfter }) => {
      const wait = runAfter - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        await runSendJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ig-send] execution ${job.executionId} failed: ${message}`);
        await finishExecution(job.executionId, "FAILED", false, false, [message]).catch(() => {});
      }
    }),
  );
}

/**
 * Perform one scheduled send. Mirrors `AutomationDispatchService.doDirectSend` / `doGatedSend`.
 *
 * Each half is attempted independently and the outcome recorded, because they fail for different
 * reasons — a DM can be refused by the 24-hour rule while the public reply posts fine, and reporting
 * that as a flat failure would hide a reply that is publicly visible on the creator's post.
 *
 * Runs once. Instagram rate limiting is retried inside `reply-service.ts`; anything else is recorded,
 * not retried — a partial success that retried would post the public reply twice, which is precisely
 * the duplicate-comment spam signal the guard layer exists to prevent.
 */
async function runSendJob(job: SendJob): Promise<void> {
  const connection = await connectionById(job.connectionId);
  if (!connection) {
    throw new Error(`ig-send: connection ${job.connectionId} no longer exists or is disconnected.`);
  }
  const ctx = { connectionId: connection.id, igUserId: connection.igUserId };

  const errors: string[] = [];
  let publicSent = false;
  let dmSent = false;

  if (job.sendPublic && job.publicText) {
    try {
      await sendPublicReplyAction(ctx, job.commentId, job.publicText);
      publicSent = true;
    } catch (error) {
      errors.push(`public: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (job.followGate) {
    // Follow-gated: the DM is the Verify prompt, and the execution parks on AWAITING_FOLLOW until the
    // recipient taps. It is not a completed send.
    try {
      await sendFollowGatePrompt(
        ctx,
        job.commentId,
        job.dmText || "Thanks! Follow me and tap the button below to unlock the link 🔓",
        job.executionId,
      );
      await finishExecution(job.executionId, "AWAITING_FOLLOW", publicSent, false, errors);
    } catch (error) {
      errors.push(`gate: ${error instanceof Error ? error.message : String(error)}`);
      await finishExecution(job.executionId, "FAILED", publicSent, false, errors);
    }
    return;
  }

  if (job.sendDm && job.dmText) {
    const text = job.dmLinkUrl
      ? job.dmText.includes(job.dmLinkUrl)
        ? job.dmText
        : `${job.dmText}\n${job.dmLinkUrl}`
      : job.dmText;
    try {
      await sendPrivateReplyAction(ctx, job.commentId, text);
      dmSent = true;
    } catch (error) {
      errors.push(`dm: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // DM_SENT outranks PUBLIC_SENT when both succeeded, matching the Java's status precedence.
  const status = dmSent ? "DM_SENT" : publicSent ? "PUBLIC_SENT" : "FAILED";
  await finishExecution(job.executionId, status, publicSent, dmSent, errors);
}

async function finishExecution(
  executionId: string,
  status: string,
  publicSent: boolean,
  dmSent: boolean,
  errors: string[],
): Promise<void> {
  await db.execute(sql`
    UPDATE ig_automation_executions
    SET status = ${status},
        public_reply_sent = ${publicSent},
        dm_sent = ${dmSent},
        error = ${errors.length > 0 ? errors.join("; ") : null},
        updated_at = now()
    WHERE id = ${executionId}::uuid
  `);
}

async function connectionById(
  connectionId: string,
): Promise<{ id: string; igUserId: string } | null> {
  const rows = await db.execute<{ [key: string]: unknown; id: string; ig_user_id: string }>(sql`
    SELECT id, ig_user_id FROM ig_automation_connections
    WHERE id = ${connectionId}::uuid AND status = 'CONNECTED' AND access_token IS NOT NULL
  `);
  const row = rows[0];
  return row ? { id: String(row.id), igUserId: String(row.ig_user_id) } : null;
}
