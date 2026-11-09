-- Flyway callback, NOT a versioned migration.
--
-- Callbacks carry no checksum and never appear in flyway_schema_history, so adding this changes
-- nothing about how existing databases validate. That is the whole point: V43 stays byte-identical
-- and production keeps booting.
--
-- Why it exists: V43 enables RLS on every table in `public` where relrowsecurity = false. Once
-- Flyway is the runner, that set includes flyway_schema_history itself -- which Flyway holds a
-- lock on for the duration of the migration, so the ALTER waits on Flyway's own lock and hangs
-- forever. That made rebuilding a database from scratch impossible.
--
-- Enabling RLS here, before the migration phase, means V43's own `relrowsecurity = false` filter
-- skips the table and never tries to lock it. No change to V43, no deadlock.
--
-- Also closes a real gap: flyway_schema_history was the one table in `public` without RLS, and
-- Supabase serves this schema over PostgREST with the anon key.
--
-- Idempotent: enabling RLS on a table that already has it is a no-op, and the guard means this is
-- safe on a database where the table does not exist yet.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'flyway_schema_history'
          AND c.relrowsecurity = false
    ) THEN
        EXECUTE 'ALTER TABLE public.flyway_schema_history ENABLE ROW LEVEL SECURITY';
    END IF;
END$$;
