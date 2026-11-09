-- =============================================================================
-- V5: Multi-platform metrics snapshot storage
-- =============================================================================
-- Supports the new MetricsAggregationService architecture.
-- Stores historical metrics snapshots for:
--   - Trend analysis
--   - Baseline snapshot creation for gamification tasks
--   - Cross-platform aggregate tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_metrics_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    total_videos    BIGINT NOT NULL DEFAULT 0,
    total_followers BIGINT NOT NULL DEFAULT 0,
    total_likes     BIGINT NOT NULL DEFAULT 0,
    total_comments  BIGINT NOT NULL DEFAULT 0,
    total_views     BIGINT NOT NULL DEFAULT 0,
    platform_breakdown JSONB,
    trigger_type    VARCHAR(50),
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_metrics_snapshots_user_id
    ON user_metrics_snapshots(user_id);

CREATE INDEX IF NOT EXISTS idx_user_metrics_snapshots_captured_at
    ON user_metrics_snapshots(captured_at);

-- =============================================================================
-- Note: gamification_task_definitions.validation_config now supports an optional
-- "platform_type" key for platform-scoped metric validation.
--
-- Example validation_config values:
--
-- Gain 100 followers across all platforms:
-- {"metric_type": "TOTAL_FOLLOWERS", "target_delta": 100}
--
-- Gain 50 followers on Instagram only:
-- {"metric_type": "TOTAL_FOLLOWERS", "target_delta": 50, "platform_type": "INSTAGRAM"}
--
-- Post 3 videos on YouTube:
-- {"metric_type": "TOTAL_POSTS", "target_delta": 3, "platform_type": "YOUTUBE"}
--
-- Reach 10,000 total views:
-- {"metric_type": "TOTAL_VIEWS", "threshold": 10000}
--
-- No schema change needed — validation_config is already JSONB.
-- =============================================================================
