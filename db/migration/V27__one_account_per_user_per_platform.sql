-- Enforce the invariant "one active account per user per platform" at the database level.
-- A user may still have historical (revoked) connections, so the uniqueness only applies to
-- non-revoked rows. Combined with the connect-time checks in the OAuth services, this makes it
-- impossible for a user to end up with two live YouTube (or two live Instagram) connections.
CREATE UNIQUE INDEX IF NOT EXISTS uq_connected_account_user_platform_active
    ON connected_accounts (user_id, platform_id)
    WHERE revoked = false;
