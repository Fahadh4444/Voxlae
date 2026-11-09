-- V21__fix_text_column_types.sql
-- Fix column types that are incorrectly set as bytea instead of text
-- This addresses the "function lower(bytea) does not exist" error in search queries

-- ==========================================
-- 1. ALTER USERS TABLE - Fix text column types
-- ==========================================

-- Fix name column type (if it's bytea, convert to VARCHAR)
-- Using USING clause to safely convert data
DO $$
BEGIN
    -- Check if name column exists and is bytea
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'name' 
        AND data_type = 'bytea'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN name TYPE VARCHAR(255) 
        USING encode(name, 'escape');
        
        RAISE NOTICE 'Altered name column from bytea to VARCHAR(255)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'name' 
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN name TYPE VARCHAR(255);
        
        RAISE NOTICE 'Altered name column to VARCHAR(255)';
    END IF;
END $$;

-- Fix niche_domain column type (if it's bytea, convert to VARCHAR)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'niche_domain' 
        AND data_type = 'bytea'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN niche_domain TYPE VARCHAR(255) 
        USING encode(niche_domain, 'escape');
        
        RAISE NOTICE 'Altered niche_domain column from bytea to VARCHAR(255)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'niche_domain' 
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN niche_domain TYPE VARCHAR(255);
        
        RAISE NOTICE 'Altered niche_domain column to VARCHAR(255)';
    END IF;
END $$;

-- Fix niche_subdomain column type (if it's bytea, convert to VARCHAR)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'niche_subdomain' 
        AND data_type = 'bytea'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN niche_subdomain TYPE VARCHAR(255) 
        USING encode(niche_subdomain, 'escape');
        
        RAISE NOTICE 'Altered niche_subdomain column from bytea to VARCHAR(255)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'niche_subdomain' 
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN niche_subdomain TYPE VARCHAR(255);
        
        RAISE NOTICE 'Altered niche_subdomain column to VARCHAR(255)';
    END IF;
END $$;

-- Fix location column type (if it's bytea, convert to VARCHAR)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'location' 
        AND data_type = 'bytea'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN location TYPE VARCHAR(255) 
        USING encode(location, 'escape');
        
        RAISE NOTICE 'Altered location column from bytea to VARCHAR(255)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'location' 
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN location TYPE VARCHAR(255);
        
        RAISE NOTICE 'Altered location column to VARCHAR(255)';
    END IF;
END $$;

-- Fix gender column type (if it's bytea, convert to VARCHAR)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'gender' 
        AND data_type = 'bytea'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN gender TYPE VARCHAR(50) 
        USING encode(gender, 'escape');
        
        RAISE NOTICE 'Altered gender column from bytea to VARCHAR(50)';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'gender' 
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE users 
        ALTER COLUMN gender TYPE VARCHAR(50);
        
        RAISE NOTICE 'Altered gender column to VARCHAR(50)';
    END IF;
END $$;

-- ==========================================
-- 2. VERIFY COLUMN TYPES
-- ==========================================
-- Log current column types for verification
DO $$
DECLARE
    col_info RECORD;
BEGIN
    FOR col_info IN 
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name IN ('name', 'niche_domain', 'niche_subdomain', 'location', 'gender')
        ORDER BY column_name
    LOOP
        RAISE NOTICE 'Column: %, Type: %, Max Length: %', 
            col_info.column_name, 
            col_info.data_type, 
            col_info.character_maximum_length;
    END LOOP;
END $$;

-- ==========================================
-- ROLLBACK PROCEDURE (manual, if needed):
-- ==========================================
-- If you need to rollback, manually check the original types and restore them
-- Note: Converting back to bytea would require proper encoding
-- ALTER TABLE users ALTER COLUMN name TYPE BYTEA USING name::bytea;
-- ALTER TABLE users ALTER COLUMN niche_domain TYPE BYTEA USING niche_domain::bytea;
-- etc.
