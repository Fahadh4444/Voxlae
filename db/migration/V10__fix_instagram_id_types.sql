-- V10: Fix Instagram table ID columns to UUID type
-- Recreate Instagram tables with correct ID types to match JPA entities

-- Drop existing Instagram tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS instagram_media_metrics CASCADE;
DROP TABLE IF EXISTS instagram_media CASCADE;
DROP TABLE IF EXISTS instagram_account_daily_metrics CASCADE;
DROP TABLE IF EXISTS instagram_account_total_metrics CASCADE;
DROP TABLE IF EXISTS instagram_accounts CASCADE;

-- Recreate with correct UUID types

-- Instagram Accounts
CREATE TABLE instagram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL UNIQUE,
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

-- Instagram Account Total Metrics
CREATE TABLE instagram_account_total_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    follower_count BIGINT DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    profile_views BIGINT DEFAULT 0,
    website_clicks BIGINT DEFAULT 0,
    email_contacts BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_account_total_metrics_account 
        FOREIGN KEY (account_id) REFERENCES instagram_accounts(account_id) ON DELETE CASCADE
);

CREATE INDEX idx_instagram_account_total_metrics_account_id ON instagram_account_total_metrics(account_id);

-- Instagram Account Daily Metrics
CREATE TABLE instagram_account_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    profile_views BIGINT DEFAULT 0,
    website_clicks BIGINT DEFAULT 0,
    email_contacts BIGINT DEFAULT 0,
    follower_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_instagram_account_daily_metrics UNIQUE (account_id, date),
    CONSTRAINT fk_instagram_account_daily_metrics_account 
        FOREIGN KEY (account_id) REFERENCES instagram_accounts(account_id) ON DELETE CASCADE
);

CREATE INDEX idx_instagram_account_daily_metrics_account_date ON instagram_account_daily_metrics(account_id, date DESC);

-- Instagram Media
CREATE TABLE instagram_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id VARCHAR(255) NOT NULL UNIQUE,
    account_id VARCHAR(255) NOT NULL,
    caption TEXT,
    media_type VARCHAR(50),
    media_url VARCHAR(1024),
    permalink VARCHAR(1024),
    thumbnail_url VARCHAR(1024),
    timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_media_account 
        FOREIGN KEY (account_id) REFERENCES instagram_accounts(account_id) ON DELETE CASCADE
);

CREATE INDEX idx_instagram_media_account_id ON instagram_media(account_id);

-- Instagram Media Metrics
CREATE TABLE instagram_media_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id VARCHAR(255) NOT NULL,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    engagement BIGINT DEFAULT 0,
    saved BIGINT DEFAULT 0,
    video_views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_instagram_media_metrics_media 
        FOREIGN KEY (media_id) REFERENCES instagram_media(media_id) ON DELETE CASCADE
);

CREATE INDEX idx_instagram_media_metrics_media_id ON instagram_media_metrics(media_id);
