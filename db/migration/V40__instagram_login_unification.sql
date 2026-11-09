-- ============================================================================
-- Unify Instagram on the Instagram-Login connection; retire the Facebook-Login analytics.
-- ============================================================================
-- Instagram analytics + automations now both run off ig_automation_connections
-- (Instagram-Login, no Facebook Page). The old Facebook-Login analytics tables and their
-- entities are removed. Instagram Performance-Trends snapshots are now keyed by
-- (user_id, platform, snapshot_date) with a NULL connected_account_id.
-- ============================================================================

-- 1. Cache profile counts on the Instagram connection (populated on connect;
--    read by the metrics provider + platform list).
ALTER TABLE ig_automation_connections ADD COLUMN IF NOT EXISTS followers_count BIGINT;
ALTER TABLE ig_automation_connections ADD COLUMN IF NOT EXISTS media_count     BIGINT;

-- 2. Performance-Trends snapshots: allow Instagram rows with no connected_account_id.
ALTER TABLE platform_daily_snapshot ALTER COLUMN connected_account_id DROP NOT NULL;

-- The existing unique (connected_account_id, snapshot_date) doesn't constrain NULL-account
-- (Instagram) rows — Postgres treats NULLs as distinct — so add a partial unique for them.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pds_user_platform_date_null_account
    ON platform_daily_snapshot (user_id, platform, snapshot_date)
    WHERE connected_account_id IS NULL;

-- 3. Drop the Facebook-Login Instagram analytics tables (CASCADE clears their FKs/indexes).
DROP TABLE IF EXISTS instagram_media_metrics          CASCADE;
DROP TABLE IF EXISTS instagram_media                  CASCADE;
DROP TABLE IF EXISTS instagram_account_daily_metrics  CASCADE;
DROP TABLE IF EXISTS instagram_account_total_metrics  CASCADE;
DROP TABLE IF EXISTS instagram_accounts               CASCADE;

-- Note: any Instagram rows left in connected_accounts (from the old Facebook-Login flow) are
-- now inert — nothing reads them, and they cascade away on account deletion. They are left in
-- place rather than deleted here to keep this migration non-destructive to that shared table.
