import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Reply variant selection and consecutive-duplicate avoidance.
 * Ports `ReplyTemplatePicker` and `ReplyTextVariator`.
 *
 * The pairing matters: the picker *rotates* across the variants a creator configured, and the
 * variator guarantees the **floor** — that no two consecutive public replies on the same post are
 * byte-identical, even when the creator configured exactly one variant. Identical repeated replies
 * are the strongest comment-spam signal Instagram acts on: comments get collapsed and the post's
 * reach is throttled.
 */

/** Meaning-preserving trailing accents, rotated in only when a duplicate would otherwise post. */
const ACCENTS = ["", " ✨", " 🙌", " 💬", " 👇", " ✅", " 📩", " 😊"] as const;

/** Uniform random choice, matching `pickRandom`. */
export function pickVariant<T>(variants: T[] | null | undefined): T | null {
  if (!variants?.length) return null;
  if (variants.length === 1) return variants[0];
  return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Return `candidate`, unless it would repeat the previous reply on `mediaId` — in which case a
 * distinct, meaning-preserving variant is returned. Records what is returned so the next call
 * compares against it.
 *
 * **Durable, unlike the Java.** `ReplyTextVariator` held this in a `ConcurrentHashMap`, which on a
 * serverless runtime is empty after every cold start — so the first reply following each cold
 * start could duplicate the previous one, which is exactly the failure the component exists to
 * prevent. The state now lives in `ig_reply_memory`.
 *
 * The read-modify-write runs in one transaction with the row locked, so two workers handling
 * comments on the same post cannot both read the same `last_sent` and both post it.
 */
export async function varyReplyText(
  mediaId: string | null,
  candidate: string | null,
): Promise<string | null> {
  if (!candidate?.trim() || !mediaId) return candidate;

  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ last_sent: string; accent_cursor: number }>(sql`
      SELECT last_sent, accent_cursor FROM ig_reply_memory
      WHERE media_id = ${mediaId}
      FOR UPDATE
    `);
    const previous = rows[0];

    let result = candidate;
    let cursor = Number(previous?.accent_cursor ?? 0);

    if (previous && previous.last_sent === candidate) {
      // Rotate through the accents until one differs from what was last sent.
      let found = false;
      for (let i = 0; i < ACCENTS.length; i++) {
        cursor = (cursor + 1) % ACCENTS.length;
        const accent = ACCENTS[cursor];
        const next = accent ? `${candidate}${accent}` : candidate;
        if (next !== previous.last_sent) {
          result = next;
          found = true;
          break;
        }
      }
      // Every accent collided (vanishingly unlikely) — fall back to a zero-width space.
      if (!found) result = `${candidate} ​`;
    }

    await tx.execute(sql`
      INSERT INTO ig_reply_memory (media_id, last_sent, accent_cursor, updated_at)
      VALUES (${mediaId}, ${result}, ${cursor}, now())
      ON CONFLICT (media_id) DO UPDATE
        SET last_sent = EXCLUDED.last_sent,
            accent_cursor = EXCLUDED.accent_cursor,
            updated_at = now()
    `);

    return result;
  });
}

/**
 * Drop memory for posts that have gone quiet. The Java bounded this by clearing the whole map at
 * 50k entries; a time-based prune is cheaper and does not throw away memory for active posts.
 * Call from the cron fan-out, never on the request path.
 */
export async function pruneReplyMemory(olderThanDays = 30): Promise<number> {
  const rows = await db.execute(sql`
    DELETE FROM ig_reply_memory
    WHERE updated_at < now() - (interval '1 day' * ${olderThanDays})
    RETURNING 1
  `);
  return rows.length;
}
