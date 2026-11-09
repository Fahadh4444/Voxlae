-- V17__otp_codes_table.sql
-- Phase 1 Step 2: Authentication expansion - OTP codes table
-- This table stores OTP codes for email verification and phone authentication.

-- ==========================================
-- 1. CREATE OTP_CODES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    otp_type VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint to ensure valid OTP type
    CONSTRAINT chk_otp_type CHECK (otp_type IN ('EMAIL', 'PHONE'))
);

-- Index for efficient OTP lookup by identifier and type
CREATE INDEX IF NOT EXISTS idx_otp_codes_identifier ON otp_codes(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_codes_type_identifier ON otp_codes(otp_type, identifier);

-- Index for cleanup queries (expired OTPs)
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE otp_codes IS 'Stores OTP codes for email verification and phone authentication';
COMMENT ON COLUMN otp_codes.identifier IS 'Email address or phone number the OTP is for';
COMMENT ON COLUMN otp_codes.otp_type IS 'Type of OTP: EMAIL or PHONE';
COMMENT ON COLUMN otp_codes.code IS '6-digit OTP code';
COMMENT ON COLUMN otp_codes.expires_at IS 'When this OTP expires (typically 5 minutes after creation)';
COMMENT ON COLUMN otp_codes.used IS 'Whether this OTP has been used';
