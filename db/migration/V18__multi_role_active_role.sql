-- V18__multi_role_active_role.sql
-- Phase 2: Multi-role support with active role tracking
-- This migration adds support for multiple roles per user with status tracking.

-- ==========================================
-- 1. ADD STATUS COLUMN TO USER_ROLES TABLE
-- ==========================================
-- Status tracks whether role setup is complete (INCOMPLETE/ACTIVE)
-- Different from verification_status which is about identity verification

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- Update existing roles to ACTIVE (they were already set up)
UPDATE user_roles SET status = 'ACTIVE' WHERE status IS NULL OR status = '';

-- ==========================================
-- 2. ADD ACTIVE_ROLE COLUMN TO USERS TABLE
-- ==========================================
-- Tracks which role the user is currently operating as
-- Nullable initially for backward compatibility

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_role VARCHAR(50);

-- ==========================================
-- 3. SET ACTIVE_ROLE FOR EXISTING USERS
-- ==========================================
-- For users with existing roles, set their active_role to their first role
-- This maintains backward compatibility

UPDATE users u
SET active_role = (
    SELECT role 
    FROM user_roles ur 
    WHERE ur.user_id = u.user_id 
    ORDER BY ur.created_at ASC 
    LIMIT 1
)
WHERE active_role IS NULL
AND EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.user_id
);

-- ==========================================
-- 4. ADD UPDATED_AT COLUMN TO USER_ROLES
-- ==========================================
-- For tracking when roles are modified

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows with current timestamp
UPDATE user_roles SET updated_at = NOW() WHERE updated_at IS NULL;

-- ==========================================
-- 5. INDEX FOR ACTIVE ROLE QUERIES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(active_role);

-- ==========================================
-- ROLLBACK PROCEDURE (manual, if needed):
-- ==========================================
-- DROP INDEX IF EXISTS idx_users_active_role;
-- ALTER TABLE user_roles DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS active_role;
-- ALTER TABLE user_roles DROP COLUMN IF EXISTS status;
