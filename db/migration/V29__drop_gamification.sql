-- V29__drop_gamification.sql
-- Remove the gamification subsystem (levels, XP, tracks, tasks, streaks).
--
-- The former "Level 0" onboarding is replaced by a lightweight setup checklist
-- (see SetupService) that is computed live from real account state and needs no
-- persisted tables. User feedback is kept (moved to its own `feedback` package)
-- and the `platforms` reference table is kept (used by connected_accounts).
--
-- CASCADE is used so drop order and any lingering FK constraints are handled
-- automatically. No retained table references these tables.

DROP TABLE IF EXISTS xp_transactions CASCADE;
DROP TABLE IF EXISTS user_task_instances CASCADE;
DROP TABLE IF EXISTS user_gamification_profiles CASCADE;
DROP TABLE IF EXISTS gamification_task_definitions CASCADE;
DROP TABLE IF EXISTS gamification_levels CASCADE;
