-- V34__drop_unused_tables.sql
-- Drops tables no Java entity maps and no code reads. All three are empty.
--
-- Verified before writing this:
--   * no @Table / @CollectionTable / @JoinTable maps any of them
--   * no repository, service or query references them
--   * all are 0 rows
--
-- Deliberately NOT dropped, despite looking suspicious:
--   user_platform          — empty, but AuthService writes it on Google signup
--   user_metrics_snapshots — 119 rows, read by MetricsAggregationService
--   (gamification_* / xp_transactions / user_task_instances are already gone)

-- Superseded by jwt_refresh_tokens (V16+); the old table was never migrated to.
DROP TABLE IF EXISTS refresh_tokens;

-- Early join-table experiment for "apps the user posts on". Replaced by
-- connected_accounts (OAuth) and user_platform (onboarding preference).
DROP TABLE IF EXISTS user_social_media_app;
DROP TABLE IF EXISTS social_media_apps;
