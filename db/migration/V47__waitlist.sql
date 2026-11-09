-- V47: Waitlist, and the allowlist that gates sign-in while Voxlae is invite-only.
--
-- One table does both jobs. A row is created when someone joins the waitlist from the landing page
-- (status PENDING); an admin approving it (status APPROVED) is what lets that email sign up or sign
-- in while ACCESS_MODE=waitlist. Admins themselves are not stored here — they come from the
-- ADMIN_EMAILS setting, so no database write can ever grant admin.
--
-- `role` is who they say they are, to see demand per side of the marketplace. It is advisory only;
-- nothing grants a Voxlae role from it.

CREATE TABLE IF NOT EXISTS waitlist (
    id           bigserial    PRIMARY KEY,
    email        varchar(255) NOT NULL,
    role         varchar(16)  NOT NULL,
    status       varchar(16)  NOT NULL DEFAULT 'PENDING',
    source       varchar(64),
    created_at   timestamptz  NOT NULL DEFAULT now(),
    approved_at  timestamptz,
    CONSTRAINT chk_waitlist_role   CHECK (role IN ('CREATOR', 'BRAND', 'FREELANCER')),
    CONSTRAINT chk_waitlist_status CHECK (status IN ('PENDING', 'APPROVED'))
);

-- Emails are compared case-insensitively everywhere else (`lower(email)`), so uniqueness is too:
-- joining twice with different capitalisation is the same person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_email ON waitlist (lower(email));

-- V43 enabled RLS on every table that existed then and does not run again, so a new table must opt
-- in explicitly or it is exposed through PostgREST with the anon key.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
