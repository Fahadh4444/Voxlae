-- V46: Last public reply sent per media, for consecutive-duplicate avoidance.
--
-- Replaces the in-process ConcurrentHashMap in ReplyTextVariator. That component
-- exists to stop the single strongest comment-spam signal: the same public reply
-- posted twice in a row on the same post, which gets comments collapsed and the
-- post's reach throttled.
--
-- In-memory state made it best-effort even on one JVM; on a serverless runtime the
-- memory is empty on every cold start, so the very first reply after each cold start
-- could duplicate the previous one. That is the precise failure the component was
-- written to prevent, so the memory has to outlive the instance.
--
-- Keyed by media only (not automation): the spam signal is about what appears under
-- one post, regardless of which automation produced it.

CREATE TABLE IF NOT EXISTS ig_reply_memory (
    media_id      varchar(255) PRIMARY KEY,
    last_sent     text         NOT NULL,
    accent_cursor integer      NOT NULL DEFAULT 0,
    updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Supports pruning rows for posts that have gone quiet; nothing reads by this column
-- otherwise.
CREATE INDEX IF NOT EXISTS idx_ig_reply_memory_updated_at
    ON ig_reply_memory USING btree (updated_at);

-- V43 enabled RLS on every table existing at that time and does not run again, so any
-- new table must opt in explicitly or it is exposed through PostgREST with the anon key.
ALTER TABLE ig_reply_memory ENABLE ROW LEVEL SECURITY;
