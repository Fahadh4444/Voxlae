-- V3__level_0_tasks.sql
-- Level 0 (Start) tasks for new user initialization

-- Level 0 tasks are the initial tasks assigned to new users
-- They must complete all Level 0 tasks before advancing to Level 1

-- ==========================================
-- Insert Level 0 (Start) task definitions
-- ==========================================
INSERT INTO gamification_task_definitions 
(name, description, icon, track_type, level_id, validation_type, validation_config, xp_reward, cooldown_weeks, sort_order, is_active, created_at, updated_at)
VALUES
    ('Connect 2 Platforms', 'Link at least 2 social media platforms to start tracking your growth across channels.', '🔗', 'LEVEL', 
     (SELECT id FROM gamification_levels WHERE level_number = 0), 
     'PLATFORM_CONNECTED', '{"min_platforms": 2}'::jsonb, 10, 0, 1, true, NOW(), NOW()),
    
    ('Post Your First Video', 'Upload at least 1 video to any connected platform to begin your content journey.', '📹', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 0),
     'METRIC_DELTA', '{"metric_type": "TOTAL_VIDEO_POSTS", "target_delta": 1}'::jsonb, 10, 0, 2, true, NOW(), NOW()),
    
    ('Give Feedback', 'Share your thoughts on the platform to help us improve your experience.', '💬', 'LEVEL',
     (SELECT id FROM gamification_levels WHERE level_number = 0),
     'FEEDBACK_PROVIDED', '{"feedback_count": 1}'::jsonb, 5, 0, 3, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
