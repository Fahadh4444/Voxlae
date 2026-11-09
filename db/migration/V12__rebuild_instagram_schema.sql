-- V12: Rebuild Instagram schema with correct column names and structure to match JPA entities

-- Drop all Instagram tables
DROP TABLE IF EXISTS instagram_media_metrics CASCADE;
DROP TABLE IF EXISTS instagram_media CASCADE;
DROP TABLE IF EXISTS instagram_account_daily_metrics CASCADE;
DROP TABLE IF EXISTS instagram_account_total_metrics CASCADE;
DROP TABLE IF EXISTS instagram_accounts CASCADE;

-- ==================== INSTAGRAM ACCOUNTS ====================
-- Primary table for Instagram Business/Creator accounts
-- Natural key: instagram_business_id (from Instagram Graph API)
CREATE TABLE instagram_accounts (
    instagram_business_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    biography TEXT,
    profile_picture_url VARCHAR(1024),
    website VARCHAR(1024),
    category VARCHAR(255),
    followers_count BIGINT DEFAULT 0,
    follows_count BIGINT DEFAULT 0,
    media_count BIGINT DEFAULT 0,
    facebook_page_id VARCHAR(64),
    facebook_page_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================== INSTAGRAM ACCOUNT TOTAL METRICS ====================
-- Stores total/lifetime metrics snapshots for Instagram accounts
-- These are cumulative metrics from Instagram Graph API (period=lifetime)
CREATE TABLE instagram_account_total_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_business_id VARCHAR(64) NOT NULL,
    snapshot_date DATE NOT NULL,
    profile_views BIGINT DEFAULT 0,
    accounts_engaged BIGINT DEFAULT 0,
    total_interactions BIGINT DEFAULT 0,
    content_views BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_account_total_metrics_account 
        FOREIGN KEY (instagram_business_id) 
        REFERENCES instagram_accounts(instagram_business_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_instagram_account_total_metrics 
        UNIQUE (instagram_business_id, snapshot_date)
);

CREATE INDEX idx_instagram_account_total_metrics_business_id 
    ON instagram_account_total_metrics(instagram_business_id);
CREATE INDEX idx_instagram_account_total_metrics_snapshot_date 
    ON instagram_account_total_metrics(snapshot_date);

-- ==================== INSTAGRAM ACCOUNT DAILY METRICS ====================
-- Stores daily time-series metrics for Instagram accounts
-- One record per account per day (period=day from Instagram Graph API)
CREATE TABLE instagram_account_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_business_id VARCHAR(64) NOT NULL,
    metric_date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    profile_views BIGINT DEFAULT 0,
    website_clicks BIGINT DEFAULT 0,
    email_contacts BIGINT DEFAULT 0,
    follower_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_account_daily_metrics_account 
        FOREIGN KEY (instagram_business_id) 
        REFERENCES instagram_accounts(instagram_business_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_instagram_account_daily_metrics 
        UNIQUE (instagram_business_id, metric_date)
);

CREATE INDEX idx_ig_account_metrics_date 
    ON instagram_account_daily_metrics(metric_date);
CREATE INDEX idx_ig_account_metrics_account_date 
    ON instagram_account_daily_metrics(instagram_business_id, metric_date);

-- ==================== INSTAGRAM MEDIA ====================
-- Instagram posts, stories, reels, IGTV videos
-- Natural key: media_id (from Instagram Graph API)
CREATE TABLE instagram_media (
    media_id VARCHAR(64) PRIMARY KEY,
    instagram_business_id VARCHAR(64) NOT NULL,
    media_type VARCHAR(32) NOT NULL,
    caption TEXT,
    permalink VARCHAR(1024),
    media_url VARCHAR(1024),
    thumbnail_url VARCHAR(1024),
    timestamp TIMESTAMP WITH TIME ZONE,
    shortcode VARCHAR(64),
    like_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_media_account 
        FOREIGN KEY (instagram_business_id) 
        REFERENCES instagram_accounts(instagram_business_id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_instagram_media_business_id 
    ON instagram_media(instagram_business_id);
CREATE INDEX idx_instagram_media_timestamp 
    ON instagram_media(timestamp DESC);

-- ==================== INSTAGRAM MEDIA METRICS ====================
-- Time-series metrics for individual Instagram media posts
-- Multiple snapshots per media (historical tracking)
CREATE TABLE instagram_media_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id VARCHAR(64) NOT NULL,
    snapshot_date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    engagement BIGINT DEFAULT 0,
    saved BIGINT DEFAULT 0,
    video_views BIGINT DEFAULT 0,
    plays BIGINT DEFAULT 0,
    exits BIGINT DEFAULT 0,
    replies BIGINT DEFAULT 0,
    taps_forward BIGINT DEFAULT 0,
    taps_back BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_media_metrics_media 
        FOREIGN KEY (media_id) 
        REFERENCES instagram_media(media_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_instagram_media_metrics 
        UNIQUE (media_id, snapshot_date)
);

CREATE INDEX idx_instagram_media_metrics_media_id 
    ON instagram_media_metrics(media_id);
CREATE INDEX idx_instagram_media_metrics_snapshot_date 
    ON instagram_media_metrics(snapshot_date);
