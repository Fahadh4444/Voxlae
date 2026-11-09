-- V43: Resolve Supabase Security & Performance advisor findings.
-- All statements are idempotent so this migration is a safe no-op if the
-- fixes were already applied out-of-band. The app connects as the `postgres`
-- role (bypasses RLS) and uses no anon/service PostgREST client, so enabling
-- RLS locks the tables from the public API without affecting the backend.

-- S1: Enable Row Level Security on every base table in `public`.
-- No policies are added; with the app on the postgres role this fully denies
-- anon/authenticated PostgREST access (secure-by-default) while the backend is
-- unaffected.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity = false
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    END LOOP;
END$$;

-- S2: Pin a non-mutable search_path on the trigger function (body only uses
-- NOW(), resolved from pg_catalog).
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- P1: Add indexes for foreign keys that lacked a covering index.
CREATE INDEX IF NOT EXISTS idx_creator_plans_profile_id
    ON public.creator_plans (profile_id);
CREATE INDEX IF NOT EXISTS idx_jwt_refresh_tokens_user_id
    ON public.jwt_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_user_platform_user_id
    ON public.user_platform (user_id);

-- P2: Drop redundant indexes. Each is a plain btree fully covered by an
-- existing UNIQUE index on identical column(s) and predicate.
DROP INDEX IF EXISTS public.idx_brand_profiles_user_id;              -- covered by brand_profiles_user_id_key
DROP INDEX IF EXISTS public.idx_creator_profiles_user_id;           -- covered by creator_profiles_user_id_key
DROP INDEX IF EXISTS public.idx_freelancer_profiles_user_id;        -- covered by freelancer_profiles_user_id_key
DROP INDEX IF EXISTS public.idx_ig_automation_connection_ig_user;   -- covered by uq_ig_automation_connection_ig_user
DROP INDEX IF EXISTS public.idx_pds_account_date;                   -- covered by uq_platform_daily_snapshot
DROP INDEX IF EXISTS public.idx_video_metrics_video_date;           -- covered by uq_video_daily_metrics
DROP INDEX IF EXISTS public.idx_youtube_video_metrics_video_date;   -- covered by uq_video_daily_metrics
