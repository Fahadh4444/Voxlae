-- V1__baseline.sql
-- Complete baseline schema for Voxlae application

-- ==========================================
-- 1. Users Table (Core Authentication)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER CHECK (age >= 0),
    gender VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    niche_domain VARCHAR(255),
    niche_subdomain VARCHAR(255),
    location VARCHAR(255),
    experience_level INTEGER CHECK (experience_level BETWEEN 1 AND 3),
    posting_frequency INTEGER CHECK (posting_frequency >= 0),
    social_expectation VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 2. JWT Refresh Tokens
-- ==========================================
CREATE TABLE IF NOT EXISTS jwt_refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(500) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jwt_refresh_tokens_user_id ON jwt_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_jwt_refresh_tokens_token ON jwt_refresh_tokens(token);

-- ==========================================
-- 3. Platforms Table (Reference Data)
-- ==========================================
CREATE TABLE IF NOT EXISTS platforms (
    platform_id BIGSERIAL PRIMARY KEY,
    platform_name VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Insert default platforms
INSERT INTO platforms (platform_name, is_active) VALUES
    ('YOUTUBE', TRUE),
    ('INSTAGRAM', TRUE),
    ('X', TRUE),
    ('LINKEDIN', TRUE)
ON CONFLICT (platform_name) DO NOTHING;

-- ==========================================
-- 4. User-Platform Join Table (Legacy Onboarding)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_platforms_used (
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform_id BIGINT NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, platform_id)
);

-- ==========================================
-- 5. Connected Accounts (OAuth)
-- ==========================================
CREATE TABLE IF NOT EXISTS connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform_id BIGINT NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    external_account_id VARCHAR(255) NOT NULL,
    account_username VARCHAR(255),
    display_name VARCHAR(255),
    profile_picture_url VARCHAR(1024),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    connection_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uq_connected_account_external UNIQUE (platform_id, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform_id ON connected_accounts(platform_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_external_id ON connected_accounts(external_account_id);

-- ==========================================
-- 6. YouTube Channels
-- ==========================================
CREATE TABLE IF NOT EXISTS youtube_channels (
    channel_id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500),
    description TEXT,
    custom_url VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    country VARCHAR(10),
    thumbnail_url VARCHAR(1024),
    subscriber_count BIGINT DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    view_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 7. YouTube Channel Daily Metrics
-- ==========================================
CREATE TABLE IF NOT EXISTS youtube_channel_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL REFERENCES youtube_channels(channel_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    estimated_minutes_watched INTEGER DEFAULT 0,
    average_view_duration_seconds INTEGER DEFAULT 0,
    subscribers_gained INTEGER DEFAULT 0,
    subscribers_lost INTEGER DEFAULT 0,
    videos_added_to_playlists INTEGER DEFAULT 0,
    videos_removed_from_playlists INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_youtube_channel_daily_metrics UNIQUE (channel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_youtube_channel_daily_metrics_channel_date ON youtube_channel_daily_metrics(channel_id, date DESC);

-- ==========================================
-- 8. YouTube Videos
-- ==========================================
CREATE TABLE IF NOT EXISTS youtube_videos (
    video_id VARCHAR(255) PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL REFERENCES youtube_channels(channel_id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    thumbnail_url VARCHAR(1024),
    duration_seconds INTEGER,
    view_count BIGINT DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    tags TEXT,
    category_id VARCHAR(50),
    default_language VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);

-- ==========================================
-- 9. YouTube Video Daily Metrics
-- ==========================================
CREATE TABLE IF NOT EXISTS youtube_video_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL REFERENCES youtube_videos(video_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    estimated_minutes_watched INTEGER DEFAULT 0,
    average_view_duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_youtube_video_daily_metrics UNIQUE (video_id, date)
);

CREATE INDEX IF NOT EXISTS idx_youtube_video_daily_metrics_video_date ON youtube_video_daily_metrics(video_id, date DESC);

-- ==========================================
-- 10. Instagram Accounts
-- ==========================================
CREATE TABLE IF NOT EXISTS instagram_accounts (
    account_id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    biography TEXT,
    profile_picture_url VARCHAR(1024),
    website VARCHAR(1024),
    followers_count INTEGER DEFAULT 0,
    follows_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 11. Instagram Account Total Metrics
-- ==========================================
CREATE TABLE IF NOT EXISTS instagram_account_total_metrics (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
    follower_count INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    profile_views INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    email_contacts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_account_total_metrics_account_id ON instagram_account_total_metrics(account_id);

-- ==========================================
-- 12. Instagram Account Daily Metrics
-- ==========================================
CREATE TABLE IF NOT EXISTS instagram_account_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    profile_views INTEGER DEFAULT 0,
    website_clicks INTEGER DEFAULT 0,
    email_contacts INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_instagram_account_daily_metrics UNIQUE (account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_instagram_account_daily_metrics_account_date ON instagram_account_daily_metrics(account_id, date DESC);

-- ==========================================
-- 13. Instagram Media
-- ==========================================
CREATE TABLE IF NOT EXISTS instagram_media (
    media_id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
    caption TEXT,
    media_type VARCHAR(50),
    media_url VARCHAR(1024),
    permalink VARCHAR(1024),
    thumbnail_url VARCHAR(1024),
    timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_media_account_id ON instagram_media(account_id);

-- ==========================================
-- 14. Instagram Media Metrics
-- ==========================================
CREATE TABLE IF NOT EXISTS instagram_media_metrics (
    id BIGSERIAL PRIMARY KEY,
    media_id VARCHAR(255) NOT NULL REFERENCES instagram_media(media_id) ON DELETE CASCADE,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    saved INTEGER DEFAULT 0,
    video_views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_media_metrics_media_id ON instagram_media_metrics(media_id);

-- ==========================================
-- 15. User Metrics Snapshot Records
-- ==========================================
CREATE TABLE IF NOT EXISTS user_metrics_snapshot_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform_id BIGINT NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_metrics_snapshot_user_platform ON user_metrics_snapshot_records(user_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_user_metrics_snapshot_timestamp ON user_metrics_snapshot_records(snapshot_at DESC);

