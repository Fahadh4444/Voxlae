-- V32__freelancer_numeric_public_id.sql
-- Public profile ids become random 8-digit numbers instead of name-derived slugs
-- ("voxlae-11" → "48213906"), so a shareable URL leaks neither the person's name
-- nor our internal row ids.

-- Replace every existing slug with a unique random 8-digit number.
-- Loop per row so each generated value is checked for collisions.
DO $$
DECLARE
    r          RECORD;
    candidate  TEXT;
    attempts   INT;
BEGIN
    FOR r IN SELECT id FROM freelancer_profiles LOOP
        attempts := 0;
        LOOP
            candidate := (10000000 + floor(random() * 90000000))::BIGINT::TEXT;
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM freelancer_profiles WHERE profile_slug = candidate
            );
            attempts := attempts + 1;
            IF attempts > 20 THEN
                RAISE EXCEPTION 'Could not allocate a unique freelancer public id';
            END IF;
        END LOOP;

        UPDATE freelancer_profiles SET profile_slug = candidate WHERE id = r.id;
    END LOOP;
END $$;

COMMENT ON COLUMN freelancer_profiles.profile_slug IS
    'Public shareable id (random 8-digit number), e.g. /freelancer/48213906';
