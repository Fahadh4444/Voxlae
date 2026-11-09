-- Add follower_count column to instagram_account_daily_metrics
-- Tracks new followers gained per day (Instagram Graph API: follower_count metric with period=day)
ALTER TABLE instagram_account_daily_metrics
    ADD COLUMN IF NOT EXISTS follower_count BIGINT NOT NULL DEFAULT 0;
