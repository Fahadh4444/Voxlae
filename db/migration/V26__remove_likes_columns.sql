-- Remove the "likes" metric everywhere it is stored.
-- Likes are no longer tracked or surfaced by any analytics feature.
ALTER TABLE youtube_channel_daily_metrics DROP COLUMN IF EXISTS likes;
ALTER TABLE youtube_video_daily_metrics   DROP COLUMN IF EXISTS likes;
ALTER TABLE instagram_media               DROP COLUMN IF EXISTS like_count;
ALTER TABLE user_metrics_snapshots        DROP COLUMN IF EXISTS total_likes;
