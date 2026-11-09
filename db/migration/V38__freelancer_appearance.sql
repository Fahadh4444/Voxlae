-- Artistic profile templates for freelancers.
--   profile_template : which layout the public profile at /freelancer/{slug} uses
--   cover_image_url  : optional hero/cover background image
--   cover_hidden_on  : CSV of template ids on which the cover is suppressed (looks wrong)
-- These make the freelancer's chosen look shareable — every visitor / device sees it,
-- not just the browser that picked it.

ALTER TABLE freelancer_profiles
    ADD COLUMN IF NOT EXISTS profile_template VARCHAR(40)  NOT NULL DEFAULT 'CLASSIC',
    ADD COLUMN IF NOT EXISTS cover_image_url  VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS cover_hidden_on  VARCHAR(255);

ALTER TABLE freelancer_profiles
    ADD CONSTRAINT chk_freelancer_profile_template
    CHECK (profile_template IN (
        'CLASSIC', 'GALLERY', 'EDITORIAL', 'SPOTLIGHT', 'STUDIO',
        'INDEX', 'TERMINAL', 'BRUTALIST', 'BENTO'
    ));
