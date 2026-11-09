-- Add real "views" metric and a cumulative total-followers snapshot to daily metrics.
--   views          -> Instagram Graph API: views metric with period=day (replaces deprecated impressions)
--   total_followers-> cumulative follower count at end of that day (reconstructed from follower_count
--                     daily gains against the account's current followers_count)
ALTER TABLE instagram_account_daily_metrics
    ADD COLUMN IF NOT EXISTS views BIGINT NOT NULL DEFAULT 0;

ALTER TABLE instagram_account_daily_metrics
    ADD COLUMN IF NOT EXISTS total_followers BIGINT NOT NULL DEFAULT 0;
