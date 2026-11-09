-- V19__freelancer_profiles.sql
-- Creates tables for freelancer profile data
-- Separate from users table to maintain role-specific data isolation

-- ==========================================
-- 1. CREATE FREELANCER_PROFILES TABLE
-- ==========================================
-- Stores freelancer-specific profile information
-- One-to-one relationship with users table

CREATE TABLE IF NOT EXISTS freelancer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    bio TEXT,
    experience VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_freelancer_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_user_id 
    ON freelancer_profiles(user_id);

-- ==========================================
-- 2. CREATE FREELANCER_SKILLS TABLE
-- ==========================================
-- Stores skills as separate rows (normalized)
-- At least 1 skill required for ACTIVE status

CREATE TABLE IF NOT EXISTS freelancer_skills (
    profile_id BIGINT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    
    CONSTRAINT fk_freelancer_skills_profile
        FOREIGN KEY (profile_id)
        REFERENCES freelancer_profiles(id)
        ON DELETE CASCADE
);

-- Index for fast profile lookup
CREATE INDEX IF NOT EXISTS idx_freelancer_skills_profile_id 
    ON freelancer_skills(profile_id);

-- ==========================================
-- 3. CREATE FREELANCER_PORTFOLIO TABLE
-- ==========================================
-- Stores portfolio links as separate rows (normalized)
-- At least 1 portfolio link required for ACTIVE status

CREATE TABLE IF NOT EXISTS freelancer_portfolio (
    profile_id BIGINT NOT NULL,
    portfolio_link VARCHAR(500) NOT NULL,
    
    CONSTRAINT fk_freelancer_portfolio_profile
        FOREIGN KEY (profile_id)
        REFERENCES freelancer_profiles(id)
        ON DELETE CASCADE
);

-- Index for fast profile lookup
CREATE INDEX IF NOT EXISTS idx_freelancer_portfolio_profile_id 
    ON freelancer_portfolio(profile_id);
