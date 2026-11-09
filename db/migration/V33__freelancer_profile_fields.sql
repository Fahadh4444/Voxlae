-- V33__freelancer_profile_fields.sql
-- Rounds out the freelancer profile with the fields clients actually filter on:
-- languages spoken, tools/software used, and a structured rate.
--
-- Rate becomes structured (amount + currency + unit) instead of the free-text
-- `rate_text`, so it can be displayed consistently and filtered/sorted later.

-- ── Languages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_languages (
    profile_id BIGINT       NOT NULL REFERENCES freelancer_profiles(id) ON DELETE CASCADE,
    sort_order INT          NOT NULL,
    language   VARCHAR(60)  NOT NULL,
    PRIMARY KEY (profile_id, sort_order)
);

-- ── Tools / software ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_tools (
    profile_id BIGINT       NOT NULL REFERENCES freelancer_profiles(id) ON DELETE CASCADE,
    sort_order INT          NOT NULL,
    tool       VARCHAR(80)  NOT NULL,
    PRIMARY KEY (profile_id, sort_order)
);

-- ── Structured rate ───────────────────────────────────────────────────
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rate_amount   NUMERIC(12,2);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rate_currency VARCHAR(8);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rate_unit     VARCHAR(10);

ALTER TABLE freelancer_profiles DROP CONSTRAINT IF EXISTS chk_freelancer_rate_unit;
ALTER TABLE freelancer_profiles
    ADD CONSTRAINT chk_freelancer_rate_unit
    CHECK (rate_unit IS NULL OR rate_unit IN ('HOUR', 'DAY', 'PROJECT'));

-- Superseded by the structured columns above (feature is new; nothing to preserve).
ALTER TABLE freelancer_profiles DROP COLUMN IF EXISTS rate_text;

COMMENT ON COLUMN freelancer_profiles.rate_amount   IS 'Starting rate, e.g. 1500';
COMMENT ON COLUMN freelancer_profiles.rate_currency IS 'ISO-ish code, e.g. INR / USD / EUR';
COMMENT ON COLUMN freelancer_profiles.rate_unit     IS 'HOUR | DAY | PROJECT';

-- ── Cached link metadata for portfolio items ──────────────────────────
-- og:title / og:description resolved from project_url, so the public profile
-- never has to fetch third-party URLs at render time.
ALTER TABLE freelancer_portfolio_items ADD COLUMN IF NOT EXISTS preview_title       VARCHAR(300);
ALTER TABLE freelancer_portfolio_items ADD COLUMN IF NOT EXISTS preview_description VARCHAR(600);
ALTER TABLE freelancer_portfolio_items ADD COLUMN IF NOT EXISTS preview_site        VARCHAR(120);
