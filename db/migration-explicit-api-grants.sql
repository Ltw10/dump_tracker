-- Optional: explicit Data API grants on dump_tracker.* (also defined in db/supabase-schema.sql).
-- Use only if you already use schema dump_tracker and need to repair grants without re-running the full schema.

GRANT SELECT ON dump_tracker.dt_users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_users TO service_role;

GRANT SELECT ON dump_tracker.dt_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_locations TO service_role;

GRANT SELECT ON dump_tracker.dt_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_entries TO service_role;

GRANT SELECT ON dump_tracker.dt_notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON dump_tracker.dt_notifications TO service_role;
