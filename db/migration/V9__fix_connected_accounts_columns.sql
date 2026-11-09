-- V9: Fix connected_accounts column names to match JPA entity
-- Idempotent column renames/drops

DO $$
BEGIN
    -- Rename account_username to account_name if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'account_username') THEN
        ALTER TABLE connected_accounts RENAME COLUMN account_username TO account_name;
    END IF;

    -- Drop display_name if it exists (not used in entity)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'display_name') THEN
        ALTER TABLE connected_accounts DROP COLUMN display_name;
    END IF;

    -- Rename profile_picture_url to account_avatar_url if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'profile_picture_url') THEN
        ALTER TABLE connected_accounts RENAME COLUMN profile_picture_url TO account_avatar_url;
    END IF;

    -- Rename token_expires_at to token_expiry if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connected_accounts' AND column_name = 'token_expires_at') THEN
        ALTER TABLE connected_accounts RENAME COLUMN token_expires_at TO token_expiry;
    END IF;
END $$;

