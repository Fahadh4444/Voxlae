-- V3__add_level_state.sql
-- Add level_state column for ACTIVE/STABILIZING state management

-- ==========================================
-- Add level_state to user_gamification_profiles
-- ==========================================
ALTER TABLE user_gamification_profiles 
ADD COLUMN IF NOT EXISTS level_state VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
CHECK (level_state IN ('ACTIVE', 'STABILIZING'));

-- Add comment for documentation
COMMENT ON COLUMN user_gamification_profiles.level_state IS 
'ACTIVE: Normal progression mode. STABILIZING: Recovery mode when performance drops. Features remain unlocked but weekly tasks replaced with recovery tasks.';

-- ==========================================
-- Add recovery tracking columns
-- ==========================================
ALTER TABLE user_gamification_profiles 
ADD COLUMN IF NOT EXISTS stabilization_started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE user_gamification_profiles 
ADD COLUMN IF NOT EXISTS recovery_tasks_completed INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_gamification_profiles.stabilization_started_at IS 
'Timestamp when user entered STABILIZING state. Used for weekly recovery evaluation.';

COMMENT ON COLUMN user_gamification_profiles.recovery_tasks_completed IS 
'Count of recovery tasks completed during current stabilization period. Reset when returning to ACTIVE.';

-- ==========================================
-- Add index for level_state queries
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profile_level_state ON user_gamification_profiles(level_state);

-- ==========================================
-- Create view for active recovery users
-- ==========================================
CREATE OR REPLACE VIEW users_in_recovery AS
SELECT 
    ugp.user_id,
    u.name AS user_name,
    u.email,
    gl.level_number,
    gl.name AS level_name,
    ugp.level_state,
    ugp.stabilization_started_at,
    ugp.recovery_tasks_completed,
    EXTRACT(DAY FROM NOW() - ugp.stabilization_started_at) AS days_in_stabilization
FROM user_gamification_profiles ugp
JOIN users u ON u.user_id = ugp.user_id
JOIN gamification_levels gl ON gl.id = ugp.current_level_id
WHERE ugp.level_state = 'STABILIZING';

COMMENT ON VIEW users_in_recovery IS 
'View showing all users currently in STABILIZING state for monitoring and support purposes.';
