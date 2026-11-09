-- V14: Rebuild YouTube schema with correct column types and names to match JPA entities

-- Drop all YouTube tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS youtube_video_daily_metrics CASCADE;
DROP TABLE IF EXISTS youtube_channel_daily_metrics CASCADE;
DROP TABLE IF EXISTS youtube_videos CASCADE;
DROP TABLE IF EXISTS youtube_channels CASCADE;

-- ==================== YOUTUBE CHANNELS ====================
-- Represents YouTube channels synced from YouTube Data API
-- Natural key: channel_id (from YouTube)
CREATE TABLE youtube_channels (
    channel_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    custom_url VARCHAR(255),
    country VARCHAR(10),
    published_at TIMESTAMP WITH TIME ZONE,
    thumbnail_url VARCHAR(1024),
    subscriber_count BIGINT DEFAULT 0,
    video_count BIGINT DEFAULT 0,
    view_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================== YOUTUBE CHANNEL DAILY METRICS ====================
-- Daily aggregated analytics for YouTube channels
-- Data source: YouTube Analytics API
CREATE TABLE youtube_channel_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id VARCHAR(64) NOT NULL,
    metric_date DATE NOT NULL,
    views BIGINT DEFAULT 0,
    estimated_minutes_watched BIGINT DEFAULT 0,
    average_view_duration BIGINT DEFAULT 0,
    subscribers_gained BIGINT DEFAULT 0,
    subscribers_lost BIGINT DEFAULT 0,
    estimated_revenue NUMERIC(12, 4) DEFAULT 0,
    estimated_ad_revenue NUMERIC(12, 4) DEFAULT 0,
    likes BIGINT DEFAULT 0,
    dislikes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_youtube_channel_daily_metrics_channel 
        FOREIGN KEY (channel_id) 
        REFERENCES youtube_channels(channel_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_channel_daily_metrics 
        UNIQUE (channel_id, metric_date)
);

CREATE INDEX idx_channel_metrics_date 
    ON youtube_channel_daily_metrics(metric_date);
CREATE INDEX idx_channel_metrics_channel_date 
    ON youtube_channel_daily_metrics(channel_id, metric_date);

-- ==================== YOUTUBE VIDEOS ====================
-- YouTube videos synced from YouTube Data API
-- Natural key: video_id (from YouTube)
CREATE TABLE youtube_videos (
    video_id VARCHAR(64) PRIMARY KEY,
    channel_id VARCHAR(64) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    duration VARCHAR(32),
    published_at TIMESTAMP WITH TIME ZONE,
    thumbnail_url VARCHAR(1024),
    privacy_status VARCHAR(32),
    live_broadcast_content VARCHAR(32),
    category_id VARCHAR(32),
    tags TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_youtube_videos_channel 
        FOREIGN KEY (channel_id) 
        REFERENCES youtube_channels(channel_id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_youtube_videos_channel_id 
    ON youtube_videos(channel_id);
CREATE INDEX idx_youtube_videos_published_at 
    ON youtube_videos(published_at);

-- ==================== YOUTUBE VIDEO DAILY METRICS ====================
-- Daily analytics for individual YouTube videos
-- Data source: YouTube Analytics API
CREATE TABLE youtube_video_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(64) NOT NULL,
    metric_date DATE NOT NULL,
    views BIGINT DEFAULT 0,
    estimated_minutes_watched BIGINT DEFAULT 0,
    average_view_duration BIGINT DEFAULT 0,
    average_view_percentage NUMERIC(5, 2) DEFAULT 0,
    likes BIGINT DEFAULT 0,
    dislikes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    traffic_sources JSONB,
    audience_demographics JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_youtube_video_daily_metrics_video 
        FOREIGN KEY (video_id) 
        REFERENCES youtube_videos(video_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_video_daily_metrics 
        UNIQUE (video_id, metric_date)
);

CREATE INDEX idx_video_metrics_date 
    ON youtube_video_daily_metrics(metric_date);
CREATE INDEX idx_video_metrics_video_date 
    ON youtube_video_daily_metrics(video_id, metric_date);
