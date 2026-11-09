-- =====================================================================
-- V28: Rebuild daily metrics as a single platform_daily_snapshot table
-- =====================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- The old design stored daily metrics in two separate, platform-specific
-- tables (youtube_channel_daily_metrics, instagram_account_daily_metrics)
-- and tried to reconstruct historical follower totals from API deltas.
-- Neither Instagram nor YouTube exposes historical follower/subscriber
-- TOTALS, so that reconstruction was unreliable and caused persistent bugs
-- in the "Performance Trends" graph.
--
-- New model: ONE row per connected account per day. We snapshot the
-- CURRENT follower total each day going forward (the only reliable figure
-- the APIs give us) and store that day's view/reach/engagement flow. This
-- is the single source of truth for BOTH the graph and gamification.
--
-- followers_total is NULLABLE on purpose: a NULL means "we had no follower
-- total for that day" (e.g. YouTube view history back-filled before we ever
-- captured a total). The UI renders NULL as "no data", never as zero.
-- =====================================================================

CREATE TABLE IF NOT EXISTS platform_daily_snapshot (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Provenance + cascade: one snapshot belongs to one connected account.
    connected_account_id  UUID   NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,

    -- Denormalised query dimensions (immutable for a given connected account),
    -- so the graph and gamification can read this as a simple single-table fact.
    user_id               BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform              VARCHAR(20) NOT NULL,           -- 'YOUTUBE' | 'INSTAGRAM'

    snapshot_date         DATE   NOT NULL,

    -- The star of the show: total followers/subscribers on this day.
    -- NULL = not captured for this day (renders as "no data", not zero).
    followers_total       BIGINT,

    -- Daily flow metrics for this day.
    views                 BIGINT NOT NULL DEFAULT 0,      -- views that day
    reach                 BIGINT NOT NULL DEFAULT 0,      -- unique reach (Instagram)
    engagement            BIGINT NOT NULL DEFAULT 0,      -- comments (YouTube) / interactions
    watch_time_minutes    BIGINT NOT NULL DEFAULT 0,      -- YouTube watch time

    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_platform_daily_snapshot UNIQUE (connected_account_id, snapshot_date)
);

-- Primary read path: "all of a user's snapshots for a platform in a date range".
CREATE INDEX IF NOT EXISTS idx_pds_user_platform_date
    ON platform_daily_snapshot(user_id, platform, snapshot_date);

-- Upsert / per-account read path.
CREATE INDEX IF NOT EXISTS idx_pds_account_date
    ON platform_daily_snapshot(connected_account_id, snapshot_date);

-- =====================================================================
-- Drop the old daily-metrics tables. All their data is intentionally
-- discarded (the follower history in them was unreliable). Real data is
-- captured forward from now on; YouTube view history is re-backfilled from
-- Google's Analytics API, which DOES serve real daily views.
--
-- NOTE: youtube_video_daily_metrics and instagram_account_total_metrics are
-- deliberately kept — they power separate features (per-video analytics and
-- Instagram total insights), not the Performance Trends graph.
-- =====================================================================

DROP TABLE IF EXISTS youtube_channel_daily_metrics;
DROP TABLE IF EXISTS instagram_account_daily_metrics;
