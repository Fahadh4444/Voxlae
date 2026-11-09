-- V22__creator_profiles.sql
-- Creates tables for creator profile and plan data
-- Separate from users table to maintain role-specific data isolation

-- ==========================================
-- 1. CREATE CREATOR_PROFILES TABLE
-- ==========================================
-- Stores creator-specific preferences from onboarding flow
-- One-to-one relationship with users table

CREATE TABLE IF NOT EXISTS creator_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    
    -- Step 1: Basic Intent
    goal VARCHAR(100),
    time_commitment VARCHAR(50),
    monetization_intent VARCHAR(20),
    
    -- Step 2: Comfort & Capability
    face_comfort VARCHAR(50),
    speaking_comfort VARCHAR(50),
    
    -- Step 3: Content Strategy
    comfort_language VARCHAR(50),
    content_type VARCHAR(50),
    is_existing_creator BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_creator_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id 
    ON creator_profiles(user_id);

-- ==========================================
-- 2. CREATE CREATOR_SKILLS TABLE
-- ==========================================
-- Stores skills as separate rows (normalized)

CREATE TABLE IF NOT EXISTS creator_skills (
    profile_id BIGINT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    
    CONSTRAINT fk_creator_skills_profile
        FOREIGN KEY (profile_id)
        REFERENCES creator_profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creator_skills_profile_id 
    ON creator_skills(profile_id);

-- ==========================================
-- 3. CREATE CREATOR_CONTENT_LANGUAGES TABLE
-- ==========================================
-- Stores content languages as separate rows (normalized)

CREATE TABLE IF NOT EXISTS creator_content_languages (
    profile_id BIGINT NOT NULL,
    language VARCHAR(100) NOT NULL,
    
    CONSTRAINT fk_creator_content_languages_profile
        FOREIGN KEY (profile_id)
        REFERENCES creator_profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creator_content_languages_profile_id 
    ON creator_content_languages(profile_id);

-- ==========================================
-- 4. CREATE CREATOR_PLATFORM_FAMILIARITY TABLE
-- ==========================================
-- Stores platforms user is familiar with

CREATE TABLE IF NOT EXISTS creator_platform_familiarity (
    profile_id BIGINT NOT NULL,
    platform VARCHAR(100) NOT NULL,
    
    CONSTRAINT fk_creator_platform_familiarity_profile
        FOREIGN KEY (profile_id)
        REFERENCES creator_profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creator_platform_familiarity_profile_id 
    ON creator_platform_familiarity(profile_id);

-- ==========================================
-- 5. CREATE CREATOR_EXISTING_PLATFORMS TABLE
-- ==========================================
-- Stores existing platforms where user already creates content

CREATE TABLE IF NOT EXISTS creator_existing_platforms (
    profile_id BIGINT NOT NULL,
    platform VARCHAR(100) NOT NULL,
    
    CONSTRAINT fk_creator_existing_platforms_profile
        FOREIGN KEY (profile_id)
        REFERENCES creator_profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creator_existing_platforms_profile_id 
    ON creator_existing_platforms(profile_id);

-- ==========================================
-- 6. CREATE CREATOR_PLANS TABLE
-- ==========================================
-- Stores AI-generated creator plans
-- Many-to-one with users (version history)

CREATE TABLE IF NOT EXISTS creator_plans (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    profile_id BIGINT,
    
    -- Plan data stored as JSON
    plan_data TEXT,
    
    -- Plan metadata
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_creator_plans_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_creator_plans_profile
        FOREIGN KEY (profile_id)
        REFERENCES creator_profiles(id)
        ON DELETE SET NULL
);

-- Index for fast user and active plan lookup
CREATE INDEX IF NOT EXISTS idx_creator_plans_user_id 
    ON creator_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_creator_plans_user_active 
    ON creator_plans(user_id, is_active) 
    WHERE is_active = TRUE;
