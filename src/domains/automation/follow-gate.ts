import { sql } from "drizzle-orm";
import { db } from "@/db";
import { validIgAccessToken } from "@/domains/platform/ensure-token";
import { getUserProfile } from "./graph-client";
import {
  sendDirectMessageAction,
  sendFollowGateRetry,
  VERIFY_PREFIX,
  type SendContext,
} from "./reply-service";

/**
 * Step two of the follow gate. Ports `FollowVerificationService`.
 *
 * When a commenter taps "I'm following ✅" the postback carries `VERIFY_FOLLOW:<executionId>`. The
 * tap itself is what makes the follow check legal: `is_user_follow_business` is only returned once
 * the user has consented by interacting, so the gate is not merely a UX device — it is the
 * mechanism that grants permission to ask.
 *
 * That has a consequence worth stating: **a failed check must never be read as "not following".**
 * A consent or transport error leaves the execution `AWAITING_FOLLOW` so the user can tap again,
 * rather than re-prompting someone who already followed.
 */

export function isVerifyPayload(payload: string | null | undefined): boolean {
  // The colon is part of the prefix; without it this also matches "VERIFY_FOLLOWED…".
  return typeof payload === "string" && payload.startsWith(VERIFY_PREFIX);
}

function parseExecutionId(payload: string): string | null {
  const id = payload.slice(VERIFY_PREFIX.length).trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export type VerifyOutcome =
  | "UNLOCKED"
  | "REPROMPTED"
  | "CHECK_FAILED"
  | "UNKNOWN_EXECUTION"
  | "ALREADY_RESOLVED"
  | "BAD_PAYLOAD";

interface ExecutionRef {
  [key: string]: unknown;
  id: string;
  automation_id: string;
  status: string;
}

/** The DM variant's unlock/prompt text and link for the automation behind this execution. */
async function dmVariant(automationId: string): Promise<{
  unlockText: string | null;
  followPromptText: string | null;
  linkUrl: string | null;
}> {
  const rows = await db.execute<{
    [key: string]: unknown;
    unlock_text: string | null;
    follow_prompt_text: string | null;
    link_url: string | null;
  }>(sql`
    SELECT unlock_text, follow_prompt_text, link_url
    FROM ig_automation_replies
    WHERE automation_id = ${automationId}::uuid AND channel = 'DM'
    ORDER BY variant_order LIMIT 1
  `);
  const row = rows[0];
  return {
    unlockText: row?.unlock_text ?? null,
    followPromptText: row?.follow_prompt_text ?? null,
    linkUrl: row?.link_url ?? null,
  };
}

export async function handleVerifyTap(
  ctx: SendContext,
  senderIgsid: string,
  payload: string,
): Promise<VerifyOutcome> {
  const executionId = parseExecutionId(payload);
  if (!executionId) return "BAD_PAYLOAD";

  const rows = await db.execute<ExecutionRef>(sql`
    SELECT id, automation_id, status FROM ig_automation_executions
    WHERE id = ${executionId}::uuid
  `);
  const execution = rows[0];
  if (!execution) return "UNKNOWN_EXECUTION";
  // A second tap on an execution already unlocked must not send the link twice.
  if (execution.status !== "AWAITING_FOLLOW") return "ALREADY_RESOLVED";

  // Captured before the check: the first prompt went out addressed by comment id, so this may be
  // the first time the recipient's IGSID is known, and it is needed to re-prompt or unlock.
  await db.execute(sql`
    UPDATE ig_automation_executions
    SET commenter_igsid = COALESCE(commenter_igsid, ${senderIgsid}), updated_at = now()
    WHERE id = ${executionId}::uuid
  `);

  const dm = await dmVariant(String(execution.automation_id));

  let follows: boolean;
  try {
    const token = await validIgAccessToken(ctx.connectionId);
    const profile = await getUserProfile(senderIgsid, token);
    if (!profile || profile.userFollowsBusiness === null) {
      // The field is absent rather than false — treat as unknown, not as "not following".
      console.warn(
        `[follow-gate] follow state unavailable for ${senderIgsid} (execution ${executionId})`,
      );
      return "CHECK_FAILED";
    }
    follows = profile.userFollowsBusiness;
  } catch (error) {
    console.warn(
      `[follow-gate] check failed for ${senderIgsid} (execution ${executionId}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return "CHECK_FAILED";
  }

  if (follows) {
    const unlock = dm.unlockText?.trim() || "You're in! Here's your link 👇";
    const message = dm.linkUrl?.trim() ? `${unlock}\n${dm.linkUrl}` : unlock;
    try {
      await sendDirectMessageAction(ctx, senderIgsid, message);
      await db.execute(sql`
        UPDATE ig_automation_executions
        SET status = 'UNLOCKED', dm_sent = true, follow_verified = true, error = NULL,
            updated_at = now()
        WHERE id = ${executionId}::uuid
      `);
      console.info(`[follow-gate] verified and link delivered (execution ${executionId})`);
      return "UNLOCKED";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.execute(sql`
        UPDATE ig_automation_executions
        SET status = 'FAILED', follow_verified = true, error = ${message}, updated_at = now()
        WHERE id = ${executionId}::uuid
      `);
      console.error(`[follow-gate] unlock DM failed (execution ${executionId}): ${message}`);
      return "CHECK_FAILED";
    }
  }

  const prompt =
    dm.followPromptText?.trim() ||
    "Almost there! Please follow me first, then tap the button again.";
  try {
    await sendFollowGateRetry(ctx, senderIgsid, prompt, executionId);
  } catch (error) {
    console.warn(
      `[follow-gate] re-prompt failed for ${senderIgsid}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  // Stays AWAITING_FOLLOW so a later tap is still accepted.
  await db.execute(sql`
    UPDATE ig_automation_executions
    SET follow_verified = false, updated_at = now() WHERE id = ${executionId}::uuid
  `);
  return "REPROMPTED";
}
