-- V23__enhance_creator_plans.sql
-- Enhances creator_plans table with AI generation metadata

-- ==========================================
-- 1. ADD AI GENERATION COLUMNS
-- ==========================================
-- Adds columns required for strict AI contract enforcement

-- Prompt version for tracking which AI prompt was used
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(50) DEFAULT 'v1.0';

-- Profile snapshot at time of generation (JSON)
-- Stores AIRequestDTO as JSON for reproducibility
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS profile_snapshot TEXT;

-- Rename plan_data to ai_output for clarity
-- Note: We keep plan_data for backward compatibility but add ai_output
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS ai_output TEXT;

-- ==========================================
-- 2. ADD GENERATION METADATA
-- ==========================================

-- Track generation status
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT 'COMPLETED';

-- Track retry attempts
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Error message if generation failed
ALTER TABLE creator_plans 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- ==========================================
-- 3. ADD INDEXES
-- ==========================================

-- Index for finding latest version
CREATE INDEX IF NOT EXISTS idx_creator_plans_user_version 
    ON creator_plans(user_id, version DESC);

-- Index for active plans by prompt version
CREATE INDEX IF NOT EXISTS idx_creator_plans_prompt_version 
    ON creator_plans(prompt_version, is_active) 
    WHERE is_active = TRUE;

-- ==========================================
-- 4. COMMENT ON COLUMNS
-- ==========================================

COMMENT ON COLUMN creator_plans.prompt_version IS 'Version of AI prompt used for generation';
COMMENT ON COLUMN creator_plans.profile_snapshot IS 'JSON snapshot of profile data at generation time';
COMMENT ON COLUMN creator_plans.ai_output IS 'Raw AI response stored as JSON';
COMMENT ON COLUMN creator_plans.generation_status IS 'PENDING, COMPLETED, FAILED';
