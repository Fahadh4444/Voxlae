-- V20__brand_profiles.sql
-- Creates table for brand profile data
-- Separate from users table to maintain role-specific data isolation

-- ==========================================
-- 1. CREATE BRAND_PROFILES TABLE
-- ==========================================
-- Stores brand-specific profile information
-- One-to-one relationship with users table

CREATE TABLE IF NOT EXISTS brand_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    company_name VARCHAR(255),
    industry VARCHAR(255),
    description TEXT,
    website VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_brand_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id 
    ON brand_profiles(user_id);
