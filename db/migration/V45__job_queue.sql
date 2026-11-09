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
