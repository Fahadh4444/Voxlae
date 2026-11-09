-- V11: Fix Instagram metric column types from INTEGER to BIGINT

-- Fix instagram_account_total_metrics
ALTER TABLE instagram_account_total_metrics 
    ALTER COLUMN follower_count TYPE BIGINT,
    ALTER COLUMN impressions TYPE BIGINT,
    ALTER COLUMN reach TYPE BIGINT,
    ALTER COLUMN profile_views TYPE BIGINT,
    ALTER COLUMN website_clicks TYPE BIGINT,
    ALTER COLUMN email_contacts TYPE BIGINT;

-- Fix instagram_account_daily_metrics
ALTER TABLE instagram_account_daily_metrics 
    ALTER COLUMN impressions TYPE BIGINT,
    ALTER COLUMN reach TYPE BIGINT,
    ALTER COLUMN profile_views TYPE BIGINT,
    ALTER COLUMN website_clicks TYPE BIGINT,
    ALTER COLUMN email_contacts TYPE BIGINT,
    ALTER COLUMN follower_count TYPE BIGINT;

-- Fix instagram_media_metrics
ALTER TABLE instagram_media_metrics 
    ALTER COLUMN impressions TYPE BIGINT,
    ALTER COLUMN reach TYPE BIGINT,
    ALTER COLUMN engagement TYPE BIGINT,
    ALTER COLUMN saved TYPE BIGINT,
    ALTER COLUMN video_views TYPE BIGINT,
    ALTER COLUMN likes TYPE BIGINT,
    ALTER COLUMN comments TYPE BIGINT,
    ALTER COLUMN shares TYPE BIGINT;
