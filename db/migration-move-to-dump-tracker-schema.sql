-- Move all Dump Tracker tables from public into schema dump_tracker (data is preserved; ALTER ... SET SCHEMA rehomes rows).
--
-- BEFORE YOU RUN THIS
-- 1. Take a backup (Supabase Dashboard → Database → Backups, or pg_dump) if production data matters.
--
-- HOW TO RUN (two steps, same project)
-- 1) Run THIS file once in the Supabase SQL Editor.
-- 2) Run the FULL contents of db/supabase-schema.sql immediately after (new tab is fine). That recreates
--    functions, triggers on dump_tracker.* tables, RLS policies, and grants in dump_tracker.
--
-- AFTER BOTH STEPS
-- • Dashboard → Project Settings → API → “Exposed schemas”: add dump_tracker (keep public if other apps need it).
-- • Deploy the app build that sets the Supabase client schema (see src/supabase.js).
--
-- Safe to re-run: if tables are already under dump_tracker, the DO block skips the move.

BEGIN;

CREATE SCHEMA IF NOT EXISTS dump_tracker;
GRANT USAGE ON SCHEMA dump_tracker TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('dt_users', 'dt_locations', 'dt_entries', 'dt_notifications')
  ) THEN
    DROP TRIGGER IF EXISTS dt_on_auth_user_created ON auth.users;

    DROP TRIGGER IF EXISTS dt_update_locations_updated_at ON public.dt_locations;
    DROP TRIGGER IF EXISTS dt_sync_count_on_insert ON public.dt_entries;
    DROP TRIGGER IF EXISTS dt_sync_count_on_delete ON public.dt_entries;
    DROP TRIGGER IF EXISTS dt_z_notify_on_entry_insert ON public.dt_entries;
    DROP TRIGGER IF EXISTS dt_notify_on_entry_update_wipes ON public.dt_entries;

    ALTER TABLE public.dt_users SET SCHEMA dump_tracker;
    ALTER TABLE public.dt_locations SET SCHEMA dump_tracker;
    ALTER TABLE public.dt_entries SET SCHEMA dump_tracker;
    ALTER TABLE public.dt_notifications SET SCHEMA dump_tracker;

    DROP FUNCTION IF EXISTS public.dt_handle_new_user() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_ensure_user_exists() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_update_updated_at_column() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_sync_location_count() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_notify_on_entry_insert() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_check_wipes_milestone_on_update() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_daily() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_weekly() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_2026() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_ghost_wipes() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_messy_dumps() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_liquid_dumps() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_explosive_dumps() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_max_wipes() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_total_wipes() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_weekly_wipes_top3() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_single_day_record() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_single_location_record() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_avg_per_day() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_leaderboard_distinct_locations() CASCADE;
    DROP FUNCTION IF EXISTS public.dt_get_notifications(integer) CASCADE;
  END IF;
END;
$$;

COMMIT;
