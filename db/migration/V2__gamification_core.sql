-- V2__gamification_core.sql
-- Core gamification tables for the VOXLAE Growth Engine

-- ==========================================
-- GamificationLevel - Level definitions
-- ==========================================
CREATE TABLE IF NOT EXISTS gamification_levels (
    id BIGSERIAL PRIMARY KEY,
    level_number INTEGER NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    xp_threshold INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default levels
INSERT INTO gamification_levels (level_number, name, description, xp_threshold, is_active, created_at, updated_at)
VALUES 
    (0, 'Start', 'Initial level - just getting started', 0, true, NOW(), NOW()),
    (1, 'Beginner', 'You are building momentum. Complete tasks to advance.', 0, true, NOW(), NOW()),
    (2, 'Consistency', 'Unlock advanced analytics and trend insights.', 0, true, NOW(), NOW()),
    (3, 'Pro', 'Unlock brand collaborations and premium visibility.', 0, true, NOW(), NOW())
ON CONFLICT (level_number) DO NOTHING;

-- ==========================================
-- GamificationTaskDefinition - Task templates
-- ==========================================
CREATE TABLE IF NOT EXISTS gamification_task_definitions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    track_type VARCHAR(50) NOT NULL CHECK (track_type IN ('LEVEL', 'WEEKLY', 'RECOVERY')),
    level_id BIGINT REFERENCES gamification_levels(id) ON DELETE SET NULL,
    validation_type VARCHAR(100) NOT NULL,
    validation_config JSONB NOT NULL DEFAULT '{}',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    cooldown_weeks INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient task queries
CREATE INDEX IF NOT EXISTS idx_task_def_track_type ON gamification_task_definitions(track_type);
CREATE INDEX IF NOT EXISTS idx_task_def_level ON gamification_task_definitions(level_id);
CREATE INDEX IF NOT EXISTS idx_task_def_active ON gamification_task_definitions(is_active);

-- ==========================================
-- UserGamificationProfile - User progress
-- ==========================================
CREATE TABLE IF NOT EXISTS user_gamification_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    current_level_id BIGINT NOT NULL REFERENCES gamification_levels(id),
    total_xp INTEGER NOT NULL DEFAULT 0,
    weekly_xp INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    level_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (level_state IN ('ACTIVE', 'STABILIZING')),
    stabilization_started_at TIMESTAMP WITH TIME ZONE,
    recovery_tasks_completed INTEGER NOT NULL DEFAULT 0,
    last_level_evaluated_at TIMESTAMP WITH TIME ZONE,
    last_weekly_reset_at TIMESTAMP WITH TIME ZONE,
    last_biweekly_evaluation_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for profile queries
CREATE INDEX IF NOT EXISTS idx_profile_level ON user_gamification_profiles(current_level_id);

-- ==========================================
-- UserTaskInstance - Task assignments
-- ==========================================
CREATE TABLE IF NOT EXISTS user_task_instances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    task_definition_id BIGINT NOT NULL REFERENCES gamification_task_definitions(id) ON DELETE CASCADE,
    track_type VARCHAR(50) NOT NULL CHECK (track_type IN ('LEVEL', 'WEEKLY', 'RECOVERY')),
    level_id_at_assignment BIGINT REFERENCES gamification_levels(id),
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED')),
    baseline_snapshot JSONB NOT NULL DEFAULT '{}',
    current_value BIGINT NOT NULL DEFAULT 0,
    target_value BIGINT NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for task instance queries
CREATE INDEX IF NOT EXISTS idx_task_instance_user ON user_task_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_task_instance_status ON user_task_instances(status);
CREATE INDEX IF NOT EXISTS idx_task_instance_track ON user_task_instances(track_type);
CREATE INDEX IF NOT EXISTS idx_task_instance_cycle ON user_task_instances(cycle_start_date, cycle_end_date);
CREATE INDEX IF NOT EXISTS idx_task_instance_user_status ON user_task_instances(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_instance_user_track ON user_task_instances(user_id, track_type);

-- ==========================================
-- XpTransaction - XP audit log
-- ==========================================
CREATE TABLE IF NOT EXISTS xp_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_task_instance_id BIGINT REFERENCES user_task_instances(id) ON DELETE SET NULL,
    xp_amount INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'TASK_COMPLETION',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for XP transaction queries
CREATE INDEX IF NOT EXISTS idx_xp_tx_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_tx_task ON xp_transactions(source_task_instance_id);
CREATE INDEX IF NOT EXISTS idx_xp_tx_created ON xp_transactions(created_at);

-- ==========================================
-- Insert default LEVEL task definitions
-- ==========================================

-- Level 1 (Beginner) tasks
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Connect a Platform', 'Link YouTube or Instagram to start tracking your growth.', '🔗', 'LEVEL', 
     (SELECT id FROM gamification_levels WHERE level_number = 1), 
     'PLATFORM_CONNECTED', '{"min_platforms": 1}'::jsonb, 5, 0, 1, true, NOW(), NOW()),
    
    ('Complete Your Profile', 'Fill in your creator profile details to personalize your experience.', '👤', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'PROFILE_COMPLETED', '{"required_fields": ["name", "nicheDomain"]}'::jsonb, 5, 0, 2, true, NOW(), NOW()),
    
    ('Post 3 Reels This Week', 'Upload 3 Instagram Reels to boost reach and consistency.', '📹', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'METRIC_DELTA', '{"metric_type": "INSTAGRAM_REELS_COUNT", "target_delta": 3}'::jsonb, 15, 0, 3, true, NOW(), NOW()),
    
    ('Reply to 10 Comments', 'Engage with your audience by responding to comments.', '💬', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'METRIC_DELTA', '{"metric_type": "COMMENTS_REPLIED", "target_delta": 10}'::jsonb, 10, 0, 4, true, NOW(), NOW()),
    
    ('Gain 50 New Followers', 'Grow your combined follower count across platforms.', '📈', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'METRIC_DELTA', '{"metric_type": "TOTAL_FOLLOWERS", "target_delta": 50}'::jsonb, 20, 0, 5, true, NOW(), NOW()),

    ('Upload a YouTube Short', 'Post at least one YouTube Short to diversify content.', '🎬', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'METRIC_DELTA', '{"metric_type": "YOUTUBE_SHORTS_COUNT", "target_delta": 1}'::jsonb, 12, 0, 6, true, NOW(), NOW()),

    ('Post at Peak Hours', 'Schedule posts during peak engagement windows.', '⏰', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 1),
     'METRIC_DELTA', '{"metric_type": "PEAK_HOUR_POSTS", "target_delta": 2}'::jsonb, 8, 0, 7, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Level 2 (Consistency) tasks
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Maintain 7-Day Streak', 'Post every day for a full week to build consistency.', '🔥', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 2),
     'STREAK_ACHIEVED', '{"min_streak": 7}'::jsonb, 25, 0, 1, true, NOW(), NOW()),
    
    ('Reach 1K Views on a Post', 'Get 1,000 views on a single post to demonstrate reach.', '👁️', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 2),
     'METRIC_THRESHOLD', '{"metric_type": "MAX_POST_VIEWS", "threshold": 1000}'::jsonb, 20, 0, 2, true, NOW(), NOW()),
    
    ('Collaborate with a Creator', 'Partner with another creator on content.', '🤝', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 2),
     'COLLABORATION_COMPLETED', '{"min_collaborations": 1}'::jsonb, 30, 0, 3, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Level 3 (Pro) tasks
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Reach 10K Total Followers', 'Grow your audience to 10K combined followers.', '🏆', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 3),
     'METRIC_THRESHOLD', '{"metric_type": "TOTAL_FOLLOWERS", "threshold": 10000}'::jsonb, 50, 0, 1, true, NOW(), NOW()),
    
    ('Land a Brand Deal', 'Complete your first brand collaboration.', '💼', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 3),
     'BRAND_DEAL_COMPLETED', '{"min_deals": 1}'::jsonb, 40, 0, 2, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ==========================================
-- Insert WEEKLY task definitions
-- ==========================================
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Post 5 Times This Week', 'Maintain consistent posting frequency.', '📅', 'WEEKLY', NULL,
     'METRIC_DELTA', '{"metric_type": "WEEKLY_POST_COUNT", "target_delta": 5}'::jsonb, 15, 1, 1, true, NOW(), NOW()),
    
    ('Gain 100 Followers', 'Grow your audience this week.', '👥', 'WEEKLY', NULL,
     'METRIC_DELTA', '{"metric_type": "WEEKLY_FOLLOWER_GAIN", "target_delta": 100}'::jsonb, 20, 1, 2, true, NOW(), NOW()),
    
    ('Get 500 Total Engagements', 'Increase likes, comments, and shares.', '❤️', 'WEEKLY', NULL,
     'METRIC_DELTA', '{"metric_type": "WEEKLY_ENGAGEMENTS", "target_delta": 500}'::jsonb, 15, 1, 3, true, NOW(), NOW()),
    
    ('Try a New Content Format', 'Experiment with a different type of content.', '🎨', 'WEEKLY', NULL,
     'CONTENT_VARIETY', '{"new_format_required": true}'::jsonb, 10, 2, 4, true, NOW(), NOW()),
    
    ('Engage with 20 Posts', 'Be active in your community.', '💬', 'WEEKLY', NULL,
     'ENGAGEMENT_GIVEN', '{"target_engagements": 20}'::jsonb, 10, 1, 5, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ==========================================
-- Insert RECOVERY task definitions
-- ==========================================
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Post 3 Times', 'Get back on track with consistent posting.', '🔄', 'RECOVERY', NULL,
     'METRIC_DELTA', '{"metric_type": "WEEKLY_POST_COUNT", "target_delta": 3}'::jsonb, 10, 0, 1, true, NOW(), NOW()),
    
    ('Engage with 10 Posts', 'Reconnect with your community.', '💪', 'RECOVERY', NULL,
     'ENGAGEMENT_GIVEN', '{"target_engagements": 10}'::jsonb, 8, 0, 2, true, NOW(), NOW()),
    
    ('Check Your Analytics', 'Review your performance data.', '📊', 'RECOVERY', NULL,
     'ANALYTICS_VIEWED', '{"pages_viewed": ["trends", "platform_detail"]}'::jsonb, 5, 0, 3, true, NOW(), NOW()),
    
    ('Update Your Profile', 'Keep your creator profile fresh.', '✏️', 'RECOVERY', NULL,
     'PROFILE_UPDATED', '{"any_field": true}'::jsonb, 5, 0, 4, true, NOW(), NOW()),
    
    ('Respond to 5 Comments', 'Re-engage with your audience.', '💬', 'RECOVERY', NULL,
     'METRIC_DELTA', '{"metric_type": "COMMENTS_REPLIED", "target_delta": 5}'::jsonb, 8, 0, 5, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ==========================================
-- Create function for updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_gamification_levels_updated_at ON gamification_levels;
CREATE TRIGGER update_gamification_levels_updated_at
    BEFORE UPDATE ON gamification_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gamification_task_definitions_updated_at ON gamification_task_definitions;
CREATE TRIGGER update_gamification_task_definitions_updated_at
    BEFORE UPDATE ON gamification_task_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_gamification_profiles_updated_at ON user_gamification_profiles;
CREATE TRIGGER update_user_gamification_profiles_updated_at
    BEFORE UPDATE ON user_gamification_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_task_instances_updated_at ON user_task_instances;
CREATE TRIGGER update_user_task_instances_updated_at
    BEFORE UPDATE ON user_task_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
