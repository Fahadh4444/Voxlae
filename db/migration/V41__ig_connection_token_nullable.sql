-- ============================================================================
-- Allow ig_automation_connections.access_token to be NULL.
-- ============================================================================
-- Disconnect clears the stored (encrypted) token via markDisconnected(), but the
-- column was NOT NULL — so the UPDATE failed at flush, the @Transactional
-- disconnect rolled back, and the account kept showing as connected on refresh
-- (while the API still reported "disconnected"). Dropping NOT NULL lets the token
-- be cleared on disconnect while the row — and its FK'd automations — is retained
-- as DISCONNECTED (reconnect re-populates the token).
-- ============================================================================

ALTER TABLE ig_automation_connections ALTER COLUMN access_token DROP NOT NULL;
