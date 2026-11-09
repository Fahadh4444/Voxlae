-- ============================================================================
-- Creator Tools: Instagram Comment Automations (comment -> public reply + DM)
-- ============================================================================
-- Adds the schema for the "Automations" creator tool:
--   * a dedicated Instagram-Login connection (separate from the analytics
--     Facebook-Login connection in connected_accounts, which has a different
--     token lifecycle and a unique (platform_id, external_account_id) constraint
--     that would collide with a second connection of the same IG account)
--   * automations, their trigger keywords, target posts and reply templates
--   * an execution ledger that both powers analytics AND enforces Meta's
--     "one private reply per comment, ever" rule (unique comment_id)
--   * a per-account opt-out (STOP) list
--
-- NOTE: comment/message webhooks fire for ALL media on a connected account, so
-- we never bulk-fetch a creator's library here; targeting is resolved at
-- dispatch time by matching the webhook's media_id against ig_automation_targets
-- (or matching everything when target_mode = 'ANY').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Instagram-Login connection used for automations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_connections (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- Instagram-scoped account id returned by the Instagram Login API (/me).
    -- This is the id that arrives on incoming comment/message webhooks.
    ig_user_id         VARCHAR(255) NOT NULL,
    username           VARCHAR(255),
    account_avatar_url VARCHAR(1024),
    -- Long-lived Instagram user token (~60 days). Encrypted at the service layer
    -- via TokenEncryptionService before storage.
    access_token       TEXT NOT NULL,
    token_expiry       TIMESTAMP WITH TIME ZONE,
    scopes             TEXT,
    -- Whether we've successfully subscribed this account to the comments/messages
    -- webhook fields (POST /{ig-id}/subscribed_apps).
    webhook_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
    -- CONNECTED | TOKEN_EXPIRED | DISCONNECTED | ERROR
    status             VARCHAR(20) NOT NULL DEFAULT 'CONNECTED',
    connected_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_refreshed_at  TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- One IG account can only be connected for automations by a single user.
    CONSTRAINT uq_ig_automation_connection_ig_user UNIQUE (ig_user_id)
);

-- One automation connection per user (we upsert in place on reconnect).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ig_automation_connection_user
    ON ig_automation_connections (user_id);

CREATE INDEX IF NOT EXISTS idx_ig_automation_connection_ig_user
    ON ig_automation_connections (ig_user_id);

-- ----------------------------------------------------------------------------
-- 2. Automations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    connection_id        UUID NOT NULL REFERENCES ig_automation_connections(id) ON DELETE CASCADE,
    name                 VARCHAR(140) NOT NULL,
    -- KEYWORD_REPLY | KEYWORD_REPLY_FOLLOW_GATED
    type                 VARCHAR(40) NOT NULL,
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    -- ANY | SPECIFIC
    target_mode          VARCHAR(20) NOT NULL DEFAULT 'SPECIFIC',
    -- When target_mode = ANY, also apply to posts created after the automation.
    include_future_posts BOOLEAN NOT NULL DEFAULT TRUE,
    -- EXACT_WORD | CONTAINS | ANY_COMMENT
    keyword_match_mode   VARCHAR(20) NOT NULL DEFAULT 'CONTAINS',
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_automations_connection ON ig_automations (connection_id);
CREATE INDEX IF NOT EXISTS idx_ig_automations_user ON ig_automations (user_id);
-- Dispatch lookup: active automations for a connection.
CREATE INDEX IF NOT EXISTS idx_ig_automations_connection_enabled
    ON ig_automations (connection_id, enabled);

-- ----------------------------------------------------------------------------
-- 3. Trigger keywords (multiple per automation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_keywords (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES ig_automations(id) ON DELETE CASCADE,
    -- Stored as entered; matching is case-insensitive at dispatch time.
    keyword       VARCHAR(140) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ig_automation_keywords_automation
    ON ig_automation_keywords (automation_id);

-- ----------------------------------------------------------------------------
-- 4. Target posts/reels (only used when target_mode = 'SPECIFIC')
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_targets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES ig_automations(id) ON DELETE CASCADE,
    media_id      VARCHAR(255) NOT NULL,
    permalink     VARCHAR(1024),
    thumbnail_url VARCHAR(1024),
    caption       TEXT,
    CONSTRAINT uq_ig_automation_target UNIQUE (automation_id, media_id)
);

-- Reverse lookup at dispatch time: which automations target this media_id.
CREATE INDEX IF NOT EXISTS idx_ig_automation_targets_media
    ON ig_automation_targets (media_id);

-- ----------------------------------------------------------------------------
-- 5. Reply templates
--    channel = PUBLIC (comment reply) | DM (private reply / follow-up DM)
--    variant_order lets us rotate 2-3 variants to look natural & avoid spam flags
--    gate copy (follow_prompt_text / unlock_text) only used by follow-gated type
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_replies (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id      UUID NOT NULL REFERENCES ig_automations(id) ON DELETE CASCADE,
    -- PUBLIC | DM
    channel            VARCHAR(20) NOT NULL,
    variant_order      INT NOT NULL DEFAULT 0,
    variant_text       TEXT NOT NULL,
    -- The link/CTA delivered in the DM (null for public-only replies).
    link_url           VARCHAR(1024),
    -- Follow-gate copy (KEYWORD_REPLY_FOLLOW_GATED only).
    follow_prompt_text TEXT,
    unlock_text        TEXT
);

CREATE INDEX IF NOT EXISTS idx_ig_automation_replies_automation
    ON ig_automation_replies (automation_id);

-- ----------------------------------------------------------------------------
-- 6. Execution ledger
--    - unique(comment_id) guarantees exactly one processing per comment, which
--      backs Meta's "one private reply per comment, ever" rule and de-dupes
--      duplicate webhook deliveries.
--    - status drives analytics and the two-step follow gate.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_executions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id    UUID NOT NULL REFERENCES ig_automations(id) ON DELETE CASCADE,
    connection_id    UUID NOT NULL REFERENCES ig_automation_connections(id) ON DELETE CASCADE,
    comment_id       VARCHAR(255) NOT NULL,
    media_id         VARCHAR(255),
    -- Instagram-scoped id of the commenter (IGSID).
    commenter_igsid  VARCHAR(255),
    commenter_username VARCHAR(255),
    comment_text     TEXT,
    -- MATCHED | PUBLIC_SENT | DM_SENT | AWAITING_FOLLOW | UNLOCKED
    -- | FAILED | SKIPPED_DUP | OPTED_OUT
    status           VARCHAR(30) NOT NULL,
    -- Follow-gate result once verified (null until the commenter interacts).
    follow_verified  BOOLEAN,
    public_reply_sent BOOLEAN NOT NULL DEFAULT FALSE,
    dm_sent          BOOLEAN NOT NULL DEFAULT FALSE,
    error            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ig_automation_execution_comment UNIQUE (comment_id)
);

CREATE INDEX IF NOT EXISTS idx_ig_automation_executions_automation
    ON ig_automation_executions (automation_id);
CREATE INDEX IF NOT EXISTS idx_ig_automation_executions_connection
    ON ig_automation_executions (connection_id);
-- Follow-gate resume: find the pending execution when a commenter later DMs/taps.
CREATE INDEX IF NOT EXISTS idx_ig_automation_executions_pending_follow
    ON ig_automation_executions (connection_id, commenter_igsid)
    WHERE status = 'AWAITING_FOLLOW';

-- ----------------------------------------------------------------------------
-- 7. Opt-out (STOP) list, per connected account
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ig_automation_optouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES ig_automation_connections(id) ON DELETE CASCADE,
    commenter_igsid VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ig_automation_optout UNIQUE (connection_id, commenter_igsid)
);
