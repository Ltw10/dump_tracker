-- Dump Tracker 2026 - Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create users table
-- Note: id should match auth.users.id from Supabase Auth
-- password_hash is not needed as Supabase Auth handles password storage
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  leaderboard_opt_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to document the leaderboard_opt_in field
COMMENT ON COLUMN users.leaderboard_opt_in IS 'Whether the user has opted in to appear on the leaderboard';

-- Create dumps table
CREATE TABLE IF NOT EXISTS dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_dumps_user_id ON dumps(user_id);

-- Create index on location_name for case-insensitive searches
CREATE INDEX IF NOT EXISTS idx_dumps_location_name ON dumps(location_name);

-- Create dump_entries table to track individual dump occurrences
-- This allows us to remove the most recent dump when decrementing
CREATE TABLE IF NOT EXISTS dump_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dump_id UUID NOT NULL REFERENCES dumps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ghost_wipe BOOLEAN DEFAULT FALSE,
  messy_dump BOOLEAN DEFAULT FALSE,
  classic_dump BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on dump_entries for faster queries
CREATE INDEX IF NOT EXISTS idx_dump_entries_dump_id ON dump_entries(dump_id);
CREATE INDEX IF NOT EXISTS idx_dump_entries_user_id ON dump_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dump_entries_created_at ON dump_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dump_entries_ghost_wipe ON dump_entries(ghost_wipe) WHERE ghost_wipe = TRUE;
CREATE INDEX IF NOT EXISTS idx_dump_entries_messy_dump ON dump_entries(messy_dump) WHERE messy_dump = TRUE;
CREATE INDEX IF NOT EXISTS idx_dump_entries_classic_dump ON dump_entries(classic_dump) WHERE classic_dump = TRUE;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dumps_updated_at ON dumps;
CREATE TRIGGER update_dumps_updated_at
  BEFORE UPDATE ON dumps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user creation
-- This automatically creates a users record when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if user already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function when a new user signs up
-- Drop trigger if it exists (for updates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to ensure user exists (can be called from client)
-- This is useful if the trigger didn't run or user was created before trigger existed
CREATE OR REPLACE FUNCTION public.ensure_user_exists()
RETURNS void AS $$
DECLARE
  current_user_id UUID;
  user_email TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get user info from auth.users
  SELECT email, raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name'
  INTO user_email, user_first_name, user_last_name
  FROM auth.users
  WHERE id = current_user_id;

  -- Insert or update user record (upsert)
  -- IMPORTANT: Preserve existing first_name and last_name if they're already set
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    current_user_id,
    COALESCE(user_email, ''),
    COALESCE(user_first_name, ''),
    COALESCE(user_last_name, '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, users.email),
    -- Only update first_name/last_name if they're currently null or empty in the users table
    -- This preserves user-set names from the Settings page
    first_name = CASE 
      WHEN users.first_name IS NULL OR users.first_name = '' 
      THEN COALESCE(EXCLUDED.first_name, '')
      ELSE users.first_name
    END,
    last_name = CASE 
      WHEN users.last_name IS NULL OR users.last_name = '' 
      THEN COALESCE(EXCLUDED.last_name, '')
      ELSE users.last_name
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_exists() TO authenticated;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dumps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can only see and update their own record
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Note: User insertion is now handled by the trigger, so we don't need an INSERT policy
-- The trigger runs with SECURITY DEFINER, so it bypasses RLS
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for dumps table
-- Users can only see their own dumps
DROP POLICY IF EXISTS "Users can view own dumps" ON dumps;
CREATE POLICY "Users can view own dumps"
  ON dumps FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own dumps
DROP POLICY IF EXISTS "Users can insert own dumps" ON dumps;
CREATE POLICY "Users can insert own dumps"
  ON dumps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own dumps
DROP POLICY IF EXISTS "Users can update own dumps" ON dumps;
CREATE POLICY "Users can update own dumps"
  ON dumps FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own dumps
DROP POLICY IF EXISTS "Users can delete own dumps" ON dumps;
CREATE POLICY "Users can delete own dumps"
  ON dumps FOR DELETE
  USING (auth.uid() = user_id);

-- Enable Row Level Security for dump_entries
ALTER TABLE dump_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dump_entries table
DROP POLICY IF EXISTS "Users can view own dump entries" ON dump_entries;
CREATE POLICY "Users can view own dump entries"
  ON dump_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own dump entries" ON dump_entries;
CREATE POLICY "Users can insert own dump entries"
  ON dump_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own dump entries" ON dump_entries;
CREATE POLICY "Users can delete own dump entries"
  ON dump_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Function to sync count from entries
CREATE OR REPLACE FUNCTION sync_dump_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the count in dumps table based on entries
  UPDATE dumps
  SET count = (
    SELECT COUNT(*)
    FROM dump_entries
    WHERE dump_entries.dump_id = COALESCE(NEW.dump_id, OLD.dump_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.dump_id, OLD.dump_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync count when entries are added
DROP TRIGGER IF EXISTS sync_count_on_insert ON dump_entries;
CREATE TRIGGER sync_count_on_insert
  AFTER INSERT ON dump_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_dump_count();

-- Trigger to sync count when entries are deleted
DROP TRIGGER IF EXISTS sync_count_on_delete ON dump_entries;
CREATE TRIGGER sync_count_on_delete
  AFTER DELETE ON dump_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_dump_count();

-- Note: Since we're using Supabase Auth, the auth.uid() function
-- will automatically return the authenticated user's ID.
-- The users.id must match auth.users.id when creating accounts.
-- The app automatically creates a users record when a user registers via Supabase Auth.

-- ============================================================================
-- Leaderboard Query Functions
-- ============================================================================
-- These functions are used by the leaderboard feature to query user statistics

-- Function to get most dumps in current day
CREATE OR REPLACE FUNCTION get_leaderboard_daily()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    COUNT(de.id)::BIGINT as dump_count
  FROM users u
  INNER JOIN dump_entries de ON de.user_id = u.id
  WHERE u.leaderboard_opt_in = TRUE
    AND u.first_name IS NOT NULL
    AND u.last_name IS NOT NULL
    AND u.first_name != ''
    AND u.last_name != ''
    AND DATE(de.created_at AT TIME ZONE 'America/New_York') = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE
  GROUP BY u.id, u.first_name, u.last_name
  HAVING COUNT(de.id) >= 1
  ORDER BY dump_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get most dumps in current week
CREATE OR REPLACE FUNCTION get_leaderboard_weekly()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    COUNT(de.id)::BIGINT as dump_count
  FROM users u
  INNER JOIN dump_entries de ON de.user_id = u.id
  WHERE u.leaderboard_opt_in = TRUE
    AND u.first_name IS NOT NULL
    AND u.last_name IS NOT NULL
    AND u.first_name != ''
    AND u.last_name != ''
    AND de.created_at >= DATE_TRUNC('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE) AT TIME ZONE 'America/New_York'
  GROUP BY u.id, u.first_name, u.last_name
  HAVING COUNT(de.id) >= 1
  ORDER BY dump_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get most dumps in 2026 (total for the year)
CREATE OR REPLACE FUNCTION get_leaderboard_2026()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    COUNT(de.id)::BIGINT as dump_count
  FROM users u
  INNER JOIN dump_entries de ON de.user_id = u.id
  WHERE u.leaderboard_opt_in = TRUE
    AND u.first_name IS NOT NULL
    AND u.last_name IS NOT NULL
    AND u.first_name != ''
    AND u.last_name != ''
    AND EXTRACT(YEAR FROM de.created_at AT TIME ZONE 'America/New_York') = 2026
  GROUP BY u.id, u.first_name, u.last_name
  HAVING COUNT(de.id) >= 1
  ORDER BY dump_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get most ghost wipes
CREATE OR REPLACE FUNCTION get_leaderboard_ghost_wipes()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  ghost_wipe_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ghost_wipe_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(de.id)::BIGINT as ghost_wipe_count
    FROM users u
    INNER JOIN dump_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
      AND de.ghost_wipe = TRUE
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(de.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(gwc2.ghost_wipe_count), 0) as highest_count
    FROM ghost_wipe_counts gwc2
  )
  SELECT 
    gwc.user_id,
    gwc.first_name,
    gwc.last_name,
    gwc.ghost_wipe_count AS ghost_wipe_count
  FROM ghost_wipe_counts gwc
  CROSS JOIN top_count tc
  WHERE tc.highest_count > 0
    AND gwc.ghost_wipe_count = tc.highest_count
  ORDER BY (gwc.ghost_wipe_count) DESC, gwc.first_name, gwc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get most messy dumps
CREATE OR REPLACE FUNCTION get_leaderboard_messy_dumps()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  messy_dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH messy_dump_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(de.id)::BIGINT as messy_dump_count
    FROM users u
    INNER JOIN dump_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
      AND de.messy_dump = TRUE
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(de.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(mdc2.messy_dump_count), 0) as highest_count
    FROM messy_dump_counts mdc2
  )
  SELECT 
    mdc.user_id,
    mdc.first_name,
    mdc.last_name,
    mdc.messy_dump_count AS messy_dump_count
  FROM messy_dump_counts mdc
  CROSS JOIN top_count tc
  WHERE tc.highest_count > 0
    AND mdc.messy_dump_count = tc.highest_count
  ORDER BY (mdc.messy_dump_count) DESC, mdc.first_name, mdc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get highest dumps in one day (across all locations)
CREATE OR REPLACE FUNCTION get_leaderboard_single_day_record()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  dump_count BIGINT,
  record_date DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      DATE(de.created_at AT TIME ZONE 'America/New_York') as dump_date,
      COUNT(de.id)::BIGINT as dump_count
    FROM users u
    INNER JOIN dump_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
    GROUP BY u.id, u.first_name, u.last_name, DATE(de.created_at AT TIME ZONE 'America/New_York')
    HAVING COUNT(de.id) > 0
  ),
  max_daily AS (
    SELECT 
      dc.user_id,
      dc.first_name,
      dc.last_name,
      MAX(dc.dump_count) as max_count
    FROM daily_counts dc
    GROUP BY dc.user_id, dc.first_name, dc.last_name
  ),
  top_count AS (
    SELECT COALESCE(MAX(max_count), 0) as highest_count
    FROM max_daily
  ),
  top_users AS (
    SELECT 
      m.user_id,
      m.first_name,
      m.last_name,
      m.max_count
    FROM max_daily m
    CROSS JOIN top_count tc
    WHERE tc.highest_count > 0
      AND m.max_count = tc.highest_count
  )
  SELECT DISTINCT ON (tu.user_id)
    tu.user_id,
    tu.first_name,
    tu.last_name,
    tu.max_count as dump_count,
    dc.dump_date as record_date
  FROM top_users tu
  INNER JOIN daily_counts dc ON dc.user_id = tu.user_id AND dc.dump_count = tu.max_count
  ORDER BY tu.user_id, dc.dump_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get highest dumps in one location
CREATE OR REPLACE FUNCTION get_leaderboard_single_location_record()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  location_name TEXT,
  dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    d.location_name,
    COUNT(de.id)::BIGINT as dump_count
  FROM users u
  INNER JOIN dumps d ON d.user_id = u.id
  INNER JOIN dump_entries de ON de.dump_id = d.id
  WHERE u.leaderboard_opt_in = TRUE
    AND u.first_name IS NOT NULL
    AND u.last_name IS NOT NULL
    AND u.first_name != ''
    AND u.last_name != ''
  GROUP BY u.id, u.first_name, u.last_name, d.id, d.location_name
  ORDER BY dump_count DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get highest average dumps per day
CREATE OR REPLACE FUNCTION get_leaderboard_avg_per_day()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  avg_dumps_per_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.created_at as account_created,
      COUNT(de.id)::NUMERIC as total_dumps,
      GREATEST(
        ((CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE - DATE(u.created_at AT TIME ZONE 'America/New_York'))::NUMERIC,
        1.0
      ) as days_since_creation
    FROM users u
    INNER JOIN dump_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
    GROUP BY u.id, u.first_name, u.last_name, u.created_at
    HAVING COUNT(de.id) >= 1
  )
  SELECT 
    us.user_id,
    us.first_name,
    us.last_name,
    ROUND((us.total_dumps / us.days_since_creation)::NUMERIC, 2) as avg_dumps_per_day
  FROM user_stats us
  ORDER BY avg_dumps_per_day DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users for leaderboard functions
GRANT EXECUTE ON FUNCTION get_leaderboard_daily() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_weekly() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_2026() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_ghost_wipes() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_messy_dumps() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_single_day_record() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_single_location_record() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_avg_per_day() TO authenticated;

