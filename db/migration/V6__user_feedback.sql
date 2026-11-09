-- V6: User feedback table for Level 0 "Give Feedback" task
-- Stores user feedback for research & product improvement.
-- One feedback per user enforced via unique constraint on user_id.

CREATE TABLE IF NOT EXISTS user_feedback (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expectation             TEXT,
    current_feeling         TEXT,
    improvement_suggestions TEXT,
    rating                  SMALLINT CHECK (rating >= 1 AND rating <= 5),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_feedback_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id
    ON user_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
    ON user_feedback(created_at);
