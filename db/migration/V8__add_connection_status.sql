-- V8: Add connection_status column to connected_accounts table
-- Optimized for Supabase timeout limits

-- Add column only if it doesn't exist (fast operation)
ALTER TABLE connected_accounts 
ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20);

-- Set values for existing rows (if column was just added)
UPDATE connected_accounts
SET connection_status = CASE
    WHEN revoked = true THEN 'DISCONNECTED'
    ELSE 'CONNECTED'
END
WHERE connection_status IS NULL;

-- Add NOT NULL constraint and default
ALTER TABLE connected_accounts 
ALTER COLUMN connection_status SET DEFAULT 'CONNECTED';

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_connected_accounts_status 
ON connected_accounts(connection_status);

