-- V35__role_setup_fields.sql
-- Supports the unified role-setup wizard that replaces the AI onboarding.
--
-- Adds the few fields the static setup collects, and — critically — backfills
-- existing users' role statuses to ACTIVE wherever they already have real data,
-- so nobody who is already set up gets re-prompted by the new setup gate.
--
-- No columns are dropped. age / gender / social_expectation stay for existing
-- data; we simply stop collecting them going forward.

-- ── New setup fields ──────────────────────────────────────────────────
ALTER TABLE users          ADD COLUMN IF NOT EXISTS primary_goal  VARCHAR(60);
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS company_size  VARCHAR(40);
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS looking_for   TEXT;

-- ── Backfill role status so existing, set-up users skip the gate ───────
-- New roles created after this change start INCOMPLETE (see RoleService), which
-- drives the setup gate. These UPDATEs make sure anyone who ALREADY has a usable
-- profile is ACTIVE and therefore never sees the wizard.

-- Influencers who already have a niche (the one field the platform uses).
UPDATE user_roles ur
SET status = 'ACTIVE'
FROM users u
WHERE ur.user_id = u.user_id
  AND ur.role = 'INFLUENCER'
  AND ur.status = 'INCOMPLETE'
  AND u.niche_domain IS NOT NULL AND u.niche_domain <> '';

-- Keep onboarding_completed in sync for those influencers.
UPDATE users
SET onboarding_completed = TRUE
WHERE niche_domain IS NOT NULL AND niche_domain <> ''
  AND onboarding_completed IS DISTINCT FROM TRUE;

-- Brands with a company name filled in.
UPDATE user_roles ur
SET status = 'ACTIVE'
FROM brand_profiles bp
WHERE ur.user_id = bp.user_id
  AND ur.role = 'BRAND'
  AND ur.status = 'INCOMPLETE'
  AND bp.company_name IS NOT NULL AND bp.company_name <> '';

-- Freelancers with a complete profile (bio + >=1 skill + >=1 portfolio item).
UPDATE user_roles ur
SET status = 'ACTIVE'
FROM freelancer_profiles fp
WHERE ur.user_id = fp.user_id
  AND ur.role = 'FREELANCER'
  AND ur.status = 'INCOMPLETE'
  AND fp.bio IS NOT NULL AND fp.bio <> ''
  AND EXISTS (SELECT 1 FROM freelancer_skills s WHERE s.profile_id = fp.id)
  AND EXISTS (SELECT 1 FROM freelancer_portfolio_items p WHERE p.profile_id = fp.id);

COMMENT ON COLUMN users.primary_goal        IS 'Influencer primary goal chosen at setup (e.g. GROW_AUDIENCE)';
COMMENT ON COLUMN brand_profiles.company_size IS 'Company size bracket chosen at brand setup';
COMMENT ON COLUMN brand_profiles.looking_for  IS 'What the brand wants from Voxlae (free text)';
