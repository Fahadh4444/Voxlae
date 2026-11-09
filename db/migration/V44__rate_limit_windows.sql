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
