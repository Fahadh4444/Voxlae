-- V16__multi_auth_role_system.sql
-- Phase 1: Multi-auth + role system foundation
-- This migration adds support for multiple authentication methods and a multi-role system.

-- ==========================================
-- 1. ALTER USERS TABLE - Add multi-auth fields
-- ==========================================
-- These columns support multiple authentication providers:
-- - GOOGLE: OAuth2 authentication (existing flow)
-- - EMAIL: Email/password authentication (future)
-- - PHONE: Phone OTP authentication (future)

-- Authentication provider (GOOGLE, EMAIL, PHONE)
-- Nullable to maintain backward compatibility with existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50);

-- Email verification status
-- For Google OAuth users, email is implicitly verified
-- For email/password users, this requires email confirmation
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Phone verification status
-- Required for phone-based authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Hashed password for email/password authentication
-- Null for OAuth-only users (Google, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Phone number for OTP authentication
-- Should be stored in E.164 format (e.g., +1234567890)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- ==========================================
-- 2. UPDATE EXISTING USERS
-- ==========================================
-- Set provider to GOOGLE for existing users (they all signed up via Google)
-- Set email_verified to true for existing users (Google verifies email)
UPDATE users 
SET provider = 'GOOGLE', 
    email_verified = TRUE 
WHERE provider IS NULL;

-- ==========================================
-- 3. CREATE USER_ROLES TABLE
-- ==========================================
-- Supports multiple roles per user with independent verification status
-- Roles: INFLUENCER, FREELANCER, BRAND, ADMIN
-- Verification: UNVERIFIED, PENDING, VERIFIED, REJECTED

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role VARCHAR(50) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key to users table with cascade delete
    CONSTRAINT fk_user_roles_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(user_id) 
        ON DELETE CASCADE,
    
    -- Unique constraint: each user can only have one instance of each role
    CONSTRAINT uq_user_role 
        UNIQUE (user_id, role)
);

-- Index for efficient lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Index for efficient lookup by role (for admin queries)
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ==========================================
-- 4. ASSIGN DEFAULT ROLE TO EXISTING USERS
-- ==========================================
-- All existing users are treated as INFLUENCER role
-- Set verification status to VERIFIED since they were using the system
INSERT INTO user_roles (user_id, role, verification_status, created_at)
SELECT user_id, 'INFLUENCER', 'VERIFIED', NOW()
FROM users
ON CONFLICT (user_id, role) DO NOTHING;

-- ==========================================
-- ROLLBACK PROCEDURE (manual, if needed):
-- ==========================================
-- DROP INDEX IF EXISTS idx_user_roles_role;
-- DROP INDEX IF EXISTS idx_user_roles_user_id;
-- DROP TABLE IF EXISTS user_roles;
-- ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
-- ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
-- ALTER TABLE users DROP COLUMN IF EXISTS phone_verified;
-- ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
-- ALTER TABLE users DROP COLUMN IF EXISTS provider;
