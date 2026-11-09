-- V30__allow_password_reset_otp_type.sql
-- Widen the otp_codes.otp_type CHECK constraint to allow password-reset codes.
-- The forgot-password flow stores OTPs with otp_type = 'PASSWORD_RESET'.

ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS chk_otp_type;

ALTER TABLE otp_codes
    ADD CONSTRAINT chk_otp_type CHECK (otp_type IN ('EMAIL', 'PHONE', 'PASSWORD_RESET'));

COMMENT ON COLUMN otp_codes.otp_type IS 'Type of OTP: EMAIL, PHONE, or PASSWORD_RESET';
