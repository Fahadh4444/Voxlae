-- V31__freelancer_public_profile.sql
-- Phase 1 of the freelancer public profile:
--  * richer profile fields (headline, avatar, location, availability, rate, slug)
--  * structured portfolio items (replaces bare links)
--  * structured experience entries (replaces the single 500-char string)

-- ── New profile fields ────────────────────────────────────────────────
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS headline     VARCHAR(120);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS avatar_url   VARCHAR(1024);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS location     VARCHAR(120);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS availability VARCHAR(20) NOT NULL DEFAULT 'OPEN_TO_OFFERS';
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS rate_text    VARCHAR(100);
ALTER TABLE freelancer_profiles ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(160);

ALTER TABLE freelancer_profiles DROP CONSTRAINT IF EXISTS chk_freelancer_availability;
ALTER TABLE freelancer_profiles
    ADD CONSTRAINT chk_freelancer_availability
    CHECK (availability IN ('AVAILABLE', 'OPEN_TO_OFFERS', 'BOOKED'));

-- Backfill slugs for existing profiles: "<name-slug>-<user_id>" (unique by construction)
UPDATE freelancer_profiles fp
SET profile_slug = trim(both '-' from lower(regexp_replace(u.name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || fp.user_id
FROM users u
WHERE u.user_id = fp.user_id AND fp.profile_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_freelancer_profile_slug ON freelancer_profiles(profile_slug);

-- ── Structured portfolio items (Hibernate @ElementCollection + @OrderColumn) ──
CREATE TABLE IF NOT EXISTS freelancer_portfolio_items (
    profile_id    BIGINT NOT NULL REFERENCES freelancer_profiles(id) ON DELETE CASCADE,
    sort_order    INT    NOT NULL,
    title         VARCHAR(150) NOT NULL,
    outcome       VARCHAR(300),
    role          VARCHAR(100),
    project_url   VARCHAR(1024),
    thumbnail_url VARCHAR(1024),
    PRIMARY KEY (profile_id, sort_order)
);

-- ── Structured experience entries ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_experience (
    profile_id   BIGINT NOT NULL REFERENCES freelancer_profiles(id) ON DELETE CASCADE,
    sort_order   INT    NOT NULL,
    title        VARCHAR(150) NOT NULL,
    organization VARCHAR(150),
    start_date   DATE,
    end_date     DATE,
    description  VARCHAR(600),
    PRIMARY KEY (profile_id, sort_order)
);

-- ── Preserve existing bare portfolio links as structured items ────────
INSERT INTO freelancer_portfolio_items (profile_id, sort_order, title, project_url)
SELECT p.profile_id,
       ROW_NUMBER() OVER (PARTITION BY p.profile_id ORDER BY p.portfolio_link) - 1,
       'Portfolio link',
       p.portfolio_link
FROM freelancer_portfolio p
ON CONFLICT DO NOTHING;

-- Old bare-links table is superseded
DROP TABLE IF EXISTS freelancer_portfolio;

COMMENT ON COLUMN freelancer_profiles.profile_slug IS 'Public shareable URL slug, e.g. /f/fahad-h-12';
