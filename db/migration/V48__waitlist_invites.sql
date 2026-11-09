-- V48: Invite links for approved waitlist entries.
--
-- Approving someone who has no account yet emails them a one-time link to create it
-- (/signup?invite=<token>). Only the SHA-256 of the token is stored, like a password: a leaked
-- database row cannot be turned back into a working link. A new link (resend / copy) replaces the
-- previous one, so at most one is ever live per entry.
--
-- `accepted_at` records when the account was created from this entry — by the invite link, or by a
-- Google sign-in with the approved email — and is what the admin page shows as "Joined".

ALTER TABLE waitlist
    ADD COLUMN IF NOT EXISTS invite_token_hash varchar(64),
    ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS invited_at        timestamptz,
    ADD COLUMN IF NOT EXISTS accepted_at       timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_invite_token
    ON waitlist (invite_token_hash) WHERE invite_token_hash IS NOT NULL;
