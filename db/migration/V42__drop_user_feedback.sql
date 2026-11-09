-- V42: Drop the user feedback feature.
-- The "Give Feedback" onboarding task and its surface were removed, so the
-- backing table (created in V6) and its indexes are no longer used.
-- Dropping the table also removes idx_user_feedback_user_id and
-- idx_user_feedback_created_at.

DROP TABLE IF EXISTS user_feedback;
