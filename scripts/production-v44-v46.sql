-- ============================================================================
-- Voxlae — bring production Supabase from V43 to V46
-- ============================================================================
-- Paste into the Supabase SQL editor and run, the same way V43 was handled.
--
-- Purely additive: three CREATE TABLE IF NOT EXISTS plus their indexes. No
-- existing table, column or row is altered. Safe to run twice.
--
-- The final statement records all three in flyway_schema_history, so Spring's
-- startup validation still passes and `./scripts/db.sh migrate` will not try to
-- apply them again. Checksums are left NULL, which Flyway treats as
-- "don't validate" rather than "mismatch" — the alternative is computing
-- Flyway's CRC32 by hand, which is exactly the kind of thing that silently
-- drifts.
-- ============================================================================

-- ─── V44__rate_limit_windows.sql ───────────────────────────────────────────
-- V44: Durable fixed-window rate-limit counters.
--
-- Replaces the in-process ConcurrentHashMap buckets in AutomationSendGuard and
-- AutomationRateLimiter. Those reset whenever the process restarts, which on a
-- serverless runtime means every cold start -- and these particular counters are
-- what keep a creator's account inside Instagram's spam thresholds, so losing
-- them throttles real accounts rather than merely missing a cache.
--
-- The primary key is what makes check-and-consume atomic: the application does a
-- single INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit, so two
-- concurrent invocations cannot both observe a free slot and both take it.
--
-- Idempotent, matching the house style of V43.

CREATE TABLE IF NOT EXISTS rate_limit_windows (
    bucket       varchar(64)  NOT NULL,
    key          varchar(255) NOT NULL,
    window_start timestamptz  NOT NULL,
    count        integer      NOT NULL DEFAULT 0,
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT rate_limit_windows_pkey PRIMARY KEY (bucket, key, window_start)
);

-- Supports the periodic purge of elapsed windows; nothing reads them, but the
-- table would otherwise grow without bound.
CREATE INDEX IF NOT EXISTS idx_rate_limit_windows_window_start
    ON rate_limit_windows USING btree (window_start);

-- V43 enabled RLS on every table that existed at the time. It does not run
-- again, so any table added afterwards must opt in explicitly or it is exposed
-- through PostgREST with the anon key. No policies: the app connects as the
-- `postgres` role and bypasses RLS, so this denies public API access outright.
ALTER TABLE rate_limit_windows ENABLE ROW LEVEL SECURITY;

-- ─── V45__job_queue.sql ───────────────────────────────────────────
-- V45: Durable job queue for scheduled fan-out.
--
-- Every @Scheduled job in the Java service is a loop over users doing per-user
-- work in one long-running invocation (DailySnapshotScheduler iterates every user
-- with a connected account; TokenHealthScheduler every account with a token).
-- A single serverless invocation is execution-capped, so that shape cannot survive
-- the move: one slow user's API call can starve everyone after them, and the whole
-- run dies at the cap with no record of how far it got.
--
-- The replacement splits it in two: a cron enumerates work and enqueues one row
-- per user (fast and bounded), and a worker claims rows a few at a time. Progress
-- is durable, failures are per-user rather than per-run, and retries are automatic.
--
-- Claiming uses FOR UPDATE SKIP LOCKED, which is what makes concurrent workers
-- safe: two workers can drain the same queue without ever handing the same job to
-- both, and without blocking each other.

CREATE TABLE IF NOT EXISTS job_queue (
    id           bigserial    PRIMARY KEY,
    kind         varchar(64)  NOT NULL,
    payload      jsonb        NOT NULL DEFAULT '{}'::jsonb,
    status       varchar(16)  NOT NULL DEFAULT 'PENDING',
    attempts     integer      NOT NULL DEFAULT 0,
    max_attempts integer      NOT NULL DEFAULT 3,
    run_after    timestamptz  NOT NULL DEFAULT now(),
    last_error   text,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT chk_job_queue_status
        CHECK (status IN ('PENDING','RUNNING','DONE','FAILED'))
);

-- The claim query's access path: pending rows that are due, oldest first.
CREATE INDEX IF NOT EXISTS idx_job_queue_claim
    ON job_queue USING btree (status, run_after)
    WHERE status = 'PENDING';

-- Lets an enqueue skip work already queued for the same target in the same run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_queue_pending_dedupe
    ON job_queue (kind, (payload->>'dedupeKey'))
    WHERE status IN ('PENDING','RUNNING') AND payload ? 'dedupeKey';

-- V43 enabled RLS on every table that existed then, and does not run again, so any
-- new table must opt in explicitly or it is exposed through PostgREST with the anon key.
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- ─── V46__automation_reply_memory.sql ───────────────────────────────────────────
-- V46: Last public reply sent per media, for consecutive-duplicate avoidance.
--
-- Replaces the in-process ConcurrentHashMap in ReplyTextVariator. That component
-- exists to stop the single strongest comment-spam signal: the same public reply
-- posted twice in a row on the same post, which gets comments collapsed and the
-- post's reach throttled.
--
-- In-memory state made it best-effort even on one JVM; on a serverless runtime the
-- memory is empty on every cold start, so the very first reply after each cold start
-- could duplicate the previous one. That is the precise failure the component was
-- written to prevent, so the memory has to outlive the instance.
--
-- Keyed by media only (not automation): the spam signal is about what appears under
-- one post, regardless of which automation produced it.

CREATE TABLE IF NOT EXISTS ig_reply_memory (
    media_id      varchar(255) PRIMARY KEY,
    last_sent     text         NOT NULL,
    accent_cursor integer      NOT NULL DEFAULT 0,
    updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Supports pruning rows for posts that have gone quiet; nothing reads by this column
-- otherwise.
CREATE INDEX IF NOT EXISTS idx_ig_reply_memory_updated_at
    ON ig_reply_memory USING btree (updated_at);

-- V43 enabled RLS on every table existing at that time and does not run again, so any
-- new table must opt in explicitly or it is exposed through PostgREST with the anon key.
ALTER TABLE ig_reply_memory ENABLE ROW LEVEL SECURITY;

-- ─── Record them so Flyway considers them applied ──────────────────────────
INSERT INTO flyway_schema_history
  (installed_rank, version, description, type, script, checksum,
   installed_by, execution_time, success)
SELECT
  (SELECT COALESCE(MAX(installed_rank), 0) FROM flyway_schema_history) + row_number() OVER (ORDER BY v.version),
  v.version, v.description, 'SQL', v.script, NULL, current_user, 0, true
FROM (VALUES
  ('44', 'rate limit windows',      'V44__rate_limit_windows.sql'),
  ('45', 'job queue',               'V45__job_queue.sql'),
  ('46', 'automation reply memory', 'V46__automation_reply_memory.sql')
) AS v(version, description, script)
WHERE NOT EXISTS (
  SELECT 1 FROM flyway_schema_history h WHERE h.version = v.version
);

-- Confirm:
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
