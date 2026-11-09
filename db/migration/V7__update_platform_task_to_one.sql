-- V7: Update "Connect 2 Platforms" task to require only 1 platform
-- Safe to run even if V4 was applied with the original 2-platform requirement.

UPDATE gamification_task_definitions
SET name              = 'Connect a Platform',
    description       = 'Link at least 1 social media platform to start tracking your growth.',
    validation_config = '{"min_platforms": 1}'::jsonb,
    updated_at        = NOW()
WHERE validation_type = 'PLATFORM_CONNECTED'
  AND level_id = (SELECT id FROM gamification_levels WHERE level_number = 0);
