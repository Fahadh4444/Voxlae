-- V15: Add performance indexes to optimize frequently-used queries
-- This migration addresses slow queries and connection issues

-- ==========================================
-- Connected Accounts Indexes
-- ==========================================

-- Composite index for user + platform lookups (most common query pattern)
-- This covers: findByUserIdAndPlatform, findAllActiveByPlatform
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_platform 
    ON connected_accounts(user_id, platform_id);

-- Index for active account lookups (used in scheduled jobs)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_active 
    ON connected_accounts(platform_id, connection_status) 
    WHERE connection_status = 'ACTIVE' AND revoked = false;

-- Index for token expiry checks (used in token refresh scheduler)
CREATE INDEX IF NOT EXISTS idx_connected_accounts_token_expiry 
    ON connected_accounts(token_expiry) 
    WHERE token_expiry IS NOT NULL AND revoked = false;

-- ==========================================
-- YouTube Tables Indexes
-- ==========================================

-- YouTube channel metrics: optimize date range queries
CREATE INDEX IF NOT EXISTS idx_youtube_channel_metrics_channel_date 
    ON youtube_channel_daily_metrics(channel_id, metric_date);

-- YouTube video metrics: optimize date range queries  
CREATE INDEX IF NOT EXISTS idx_youtube_video_metrics_video_date 
    ON youtube_video_daily_metrics(video_id, metric_date);

-- YouTube videos: optimize channel lookups with ordering
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_published 
    ON youtube_videos(channel_id, published_at DESC);

-- ==========================================
-- Gamification Tables Indexes  
-- ==========================================

-- User task instances: optimize active task lookups
CREATE INDEX IF NOT EXISTS idx_user_task_instances_user_status 
    ON user_task_instances(user_id, status) 
    WHERE status IN ('ACTIVE', 'IN_PROGRESS');

-- XP transactions: optimize user history lookups
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_created 
    ON xp_transactions(user_id, created_at DESC);

-- User gamification profiles: optimize level lookups
CREATE INDEX IF NOT EXISTS idx_user_gamification_profiles_level 
    ON user_gamification_profiles(current_level_id);

-- ==========================================
-- Analyze tables to update query planner statistics
-- ==========================================
ANALYZE connected_accounts;
ANALYZE instagram_accounts;
ANALYZE instagram_account_daily_metrics;
ANALYZE instagram_account_total_metrics;
ANALYZE instagram_media;
ANALYZE instagram_media_metrics;
