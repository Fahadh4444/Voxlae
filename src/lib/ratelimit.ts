import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Durable fixed-window rate limiting.
 *
 * The direct replacement for Spring's `AutomationSendGuard` / `AutomationRateLimiter`, whose
 * counters live in `ConcurrentHashMap`s and therefore reset on every process start. Under
 * serverless that is every cold start, and these particular counters are what hold a creator's
 * account inside Instagram's spam thresholds — so losing them throttles real accounts rather
 * than merely missing a cache.
 *
 * `reserve()` checks and consumes in a single statement. That atomicity is the point: a
 * read-then-write pair lets two concurrent invocations both observe `count = limit - 1` and both
 * proceed, which is exactly the burst the caps exist to prevent. Postgres resolves the race for
 * us via the primary key and the conditional `DO UPDATE`.
 */

export interface ReserveResult {
  /** Whether a slot was taken. When false, nothing was consumed. */
  allowed: boolean;
  /** Count after this call (or the current count when refused). */
  count: number;
  /** Ceiling applied. */
  limit: number;
  /** When the current window rolls over. */
  resetAt: Date;
}

/**
 * Windows are **epoch-aligned**, not calendar-aligned: `floor(epochMs / windowMs) * windowMs`.
 *
 * Deliberate — it is timezone-independent, so the same instant lands in the same window whatever
 * the session or server timezone is, and it works for any window size rather than only whole
 * hours or days.
 *
 * It does mean an epoch-aligned hour is **not** `date_trunc('hour', now())` unless the session
 * timezone happens to be a whole-hour offset from UTC. At +05:30 the two differ by 30 minutes,
 * so a hand-written query against this table must use
 * `to_timestamp(floor(extract(epoch from now()) / 3600) * 3600)` to look at the live window.
 */
function windowStart(windowMs: number, now = Date.now()): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/**
 * Try to take one slot from `bucket`/`key`.
 *
 * Returns `allowed: false` without consuming anything when the window is full — callers should
 * skip the send (Spring marks these `THROTTLED`) rather than queue it.
 */
export async function reserve(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<ReserveResult> {
  const start = windowStart(windowMs);
  const resetAt = new Date(start.getTime() + windowMs);

  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_windows (bucket, key, window_start, count, updated_at)
    VALUES (${bucket}, ${key}, ${start.toISOString()}, 1, now())
    ON CONFLICT (bucket, key, window_start) DO UPDATE
      SET count = rate_limit_windows.count + 1,
          updated_at = now()
      WHERE rate_limit_windows.count < ${limit}
    RETURNING count
  `);

  // Housekeeping without a scheduler: roughly one call in a hundred sweeps elapsed windows. Each
  // account/bucket adds at most one row per window, so this keeps pace with growth at negligible cost.
  if (Math.random() < PURGE_PROBABILITY) {
    await purgeExpired().catch((error) => console.warn("[ratelimit] purge failed:", error));
  }

  const row = rows[0] as { count: number } | undefined;
  if (!row) {
    // The conditional UPDATE matched nothing, meaning the window is already at its limit.
    const current = await peek(bucket, key, windowMs);
    return { allowed: false, count: current, limit, resetAt };
  }
  return { allowed: true, count: Number(row.count), limit, resetAt };
}

/** Current count without consuming. */
export async function peek(
  bucket: string,
  key: string,
  windowMs: number,
): Promise<number> {
  const start = windowStart(windowMs);
  const rows = await db.execute<{ count: number }>(sql`
    SELECT count FROM rate_limit_windows
    WHERE bucket = ${bucket} AND key = ${key} AND window_start = ${start.toISOString()}
  `);
  const row = rows[0] as { count: number } | undefined;
  return row ? Number(row.count) : 0;
}

const PURGE_PROBABILITY = 0.01;

/**
 * Delete windows that have fully elapsed. Nothing reads them, but the table would grow without
 * bound. Called from `reserve()` on a small fraction of requests.
 */
export async function purgeExpired(olderThanMs = 48 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = await db.execute(sql`
    DELETE FROM rate_limit_windows WHERE window_start < ${cutoff} RETURNING 1
  `);
  return rows.length;
}

/**
 * The caps Spring applies, carried over unchanged from `AutomationSendGuard`. Deliberately well
 * inside Meta's own ceilings — DMs sit at roughly half the ~200/hr platform limit, leaving
 * headroom for a post that goes viral.
 */
export const IG_LIMITS = {
  publicPerAccountHour: { bucket: "ig_public_account", limit: 60, windowMs: 3_600_000 },
  publicPerMediaHour: { bucket: "ig_public_media", limit: 30, windowMs: 3_600_000 },
  dmPerAccountHour: { bucket: "ig_dm_account_h", limit: 150, windowMs: 3_600_000 },
  dmPerAccountDay: { bucket: "ig_dm_account_d", limit: 1500, windowMs: 86_400_000 },
} as const;

/**
 * Reserve one slot from **two** buckets, all-or-nothing.
 *
 * Needed because `AutomationSendGuard.tryReservePublic` deliberately peeks both the per-account
 * and per-media caps *before* consuming either: reserving them one at a time means a full media
 * cap silently burns account budget that was never used to send anything. Over a busy hour that
 * drift compounds and throttles an account well below its real limit.
 *
 * Both writes run inside one transaction, so either both counters move or neither does.
 */
export async function reservePair(
  first: { bucket: string; key: string; limit: number; windowMs: number },
  second: { bucket: string; key: string; limit: number; windowMs: number },
): Promise<{ allowed: boolean; blockedBy?: string }> {
  return db.transaction(async (tx) => {
    const check = async (b: typeof first) => {
      const start = windowStart(b.windowMs);
      const rows = await tx.execute<{ count: number }>(sql`
        SELECT count FROM rate_limit_windows
        WHERE bucket = ${b.bucket} AND key = ${b.key} AND window_start = ${start.toISOString()}
        FOR UPDATE
      `);
      return Number(rows[0]?.count ?? 0);
    };

    // Peek both first — this ordering is the whole point.
    if ((await check(first)) >= first.limit) {
      return { allowed: false, blockedBy: first.bucket };
    }
    if ((await check(second)) >= second.limit) {
      return { allowed: false, blockedBy: second.bucket };
    }

    const consume = async (b: typeof first) => {
      const start = windowStart(b.windowMs);
      await tx.execute(sql`
        INSERT INTO rate_limit_windows (bucket, key, window_start, count, updated_at)
        VALUES (${b.bucket}, ${b.key}, ${start.toISOString()}, 1, now())
        ON CONFLICT (bucket, key, window_start) DO UPDATE
          SET count = rate_limit_windows.count + 1, updated_at = now()
      `);
    };
    await consume(first);
    await consume(second);
    return { allowed: true };
  });
}

/**
 * Warm-up ramp for a new connection, from `AutomationSendGuard.warmupFactor`.
 *
 * A brand-new account that immediately starts replying at full rate looks exactly like a bot to
 * Instagram's spam heuristics, so the first day runs at half the caps and days two and three at
 * three quarters.
 */
export function warmupFactor(connectedAt: Date | string | null | undefined): number {
  if (!connectedAt) return 1.0;
  const connected =
    connectedAt instanceof Date
      ? connectedAt
      : new Date(String(connectedAt).replace(" ", "T"));
  if (Number.isNaN(connected.getTime())) return 1.0;

  const ageHours = (Date.now() - connected.getTime()) / 3_600_000;
  if (ageHours < 24) return 0.5;
  if (ageHours < 72) return 0.75;
  return 1.0;
}

/** `Math.max(1, ceil(base * ramp))` — never ramps a cap to zero. */
export function scaled(base: number, ramp: number): number {
  return Math.max(1, Math.ceil(base * ramp));
}
