-- V13: Rename user_platforms_used to user_platform to match JPA entity @JoinTable name
-- Idempotent: Only renames if old table exists

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_platforms_used'
    ) THEN
        ALTER TABLE user_platforms_used RENAME TO user_platform;
    END IF;
END $$;
