-- Dump Tracker 2026 - Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Dump Tracker: all objects prefixed with dt_ for a shared database.
-- Table names: dt_users (profiles), dt_locations (one per user per place), dt_entries (individual logs), dt_notifications.

-- dt_users: app user profile (id matches auth.users)
CREATE TABLE IF NOT EXISTS dt_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  leaderboard_opt_in BOOLEAN DEFAULT FALSE,
  location_tracking_opt_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN dt_users.leaderboard_opt_in IS 'Whether the user has opted in to appear on the leaderboard';
COMMENT ON COLUMN dt_users.location_tracking_opt_in IS 'Whether the user has opted in to location tracking features';

-- dt_locations: one row per user per location (name + count + optional address)
CREATE TABLE IF NOT EXISTS dt_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dt_users(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  address TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  location_data_provided BOOLEAN DEFAULT FALSE,
  location_data_declined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN dt_locations.address IS 'Street address or location description provided by user';
COMMENT ON COLUMN dt_locations.latitude IS 'Latitude coordinate if GPS location was provided';
COMMENT ON COLUMN dt_locations.longitude IS 'Longitude coordinate if GPS location was provided';
COMMENT ON COLUMN dt_locations.location_data_provided IS 'Whether specific location data (address or GPS) has been provided';
COMMENT ON COLUMN dt_locations.location_data_declined IS 'Whether user has declined to provide location data for this location';

CREATE INDEX IF NOT EXISTS idx_dt_locations_user_id ON dt_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_dt_locations_location_name ON dt_locations(location_name);

-- dt_entries: individual dump events at a location (supports decrement / type)
CREATE TABLE IF NOT EXISTS dt_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES dt_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dt_users(id) ON DELETE CASCADE,
  ghost_wipe BOOLEAN DEFAULT FALSE,
  messy_dump BOOLEAN DEFAULT FALSE,
  classic_dump BOOLEAN DEFAULT FALSE,
  liquid_dump BOOLEAN DEFAULT FALSE,
  explosive_dump BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wipes INTEGER
);

ALTER TABLE dt_entries ADD COLUMN IF NOT EXISTS explosive_dump BOOLEAN DEFAULT FALSE;
ALTER TABLE dt_entries ADD COLUMN IF NOT EXISTS wipes INTEGER;
CREATE INDEX IF NOT EXISTS idx_dt_entries_explosive_dump ON dt_entries(explosive_dump) WHERE explosive_dump = TRUE;

CREATE INDEX IF NOT EXISTS idx_dt_entries_location_id ON dt_entries(location_id);
CREATE INDEX IF NOT EXISTS idx_dt_entries_user_id ON dt_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dt_entries_created_at ON dt_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dt_entries_ghost_wipe ON dt_entries(ghost_wipe) WHERE ghost_wipe = TRUE;
CREATE INDEX IF NOT EXISTS idx_dt_entries_messy_dump ON dt_entries(messy_dump) WHERE messy_dump = TRUE;
CREATE INDEX IF NOT EXISTS idx_dt_entries_classic_dump ON dt_entries(classic_dump) WHERE classic_dump = TRUE;
CREATE INDEX IF NOT EXISTS idx_dt_entries_liquid_dump ON dt_entries(liquid_dump) WHERE liquid_dump = TRUE;

-- dt_notifications: feed of events for opted-in users
CREATE TABLE IF NOT EXISTS dt_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES dt_users(id) ON DELETE CASCADE,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dt_notifications_created_at ON dt_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dt_notifications_type ON dt_notifications(type);

-- Dump Tracker: update updated_at on dt_locations
CREATE OR REPLACE FUNCTION dt_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS dt_update_locations_updated_at ON dt_locations;
CREATE TRIGGER dt_update_locations_updated_at
  BEFORE UPDATE ON dt_locations
  FOR EACH ROW
  EXECUTE FUNCTION dt_update_updated_at_column();

-- Create dt_users row when a new auth user is created
CREATE OR REPLACE FUNCTION public.dt_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.dt_users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dt_on_auth_user_created ON auth.users;
CREATE TRIGGER dt_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.dt_handle_new_user();

-- Ensure dt_users row exists (call from client if trigger missed)
CREATE OR REPLACE FUNCTION public.dt_ensure_user_exists()
RETURNS void AS $$
DECLARE
  current_user_id UUID;
  user_email TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  SELECT email, raw_user_meta_data->>'first_name', raw_user_meta_data->>'last_name'
  INTO user_email, user_first_name, user_last_name
  FROM auth.users
  WHERE id = current_user_id;

  INSERT INTO public.dt_users (id, email, first_name, last_name)
  VALUES (
    current_user_id,
    COALESCE(user_email, ''),
    COALESCE(user_first_name, ''),
    COALESCE(user_last_name, '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, dt_users.email),
    first_name = CASE 
      WHEN dt_users.first_name IS NULL OR dt_users.first_name = '' 
      THEN COALESCE(EXCLUDED.first_name, '')
      ELSE dt_users.first_name
    END,
    last_name = CASE 
      WHEN dt_users.last_name IS NULL OR dt_users.last_name = '' 
      THEN COALESCE(EXCLUDED.last_name, '')
      ELSE dt_users.last_name
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.dt_ensure_user_exists() TO authenticated;

-- Enable Row Level Security
ALTER TABLE dt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dt_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_users_select_own" ON dt_users;
CREATE POLICY "dt_users_select_own"
  ON dt_users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "dt_users_insert_own" ON dt_users;

DROP POLICY IF EXISTS "dt_users_update_own" ON dt_users;
CREATE POLICY "dt_users_update_own"
  ON dt_users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "dt_locations_select_own" ON dt_locations;
CREATE POLICY "dt_locations_select_own"
  ON dt_locations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_locations_insert_own" ON dt_locations;
CREATE POLICY "dt_locations_insert_own"
  ON dt_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_locations_update_own" ON dt_locations;
CREATE POLICY "dt_locations_update_own"
  ON dt_locations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_locations_delete_own" ON dt_locations;
CREATE POLICY "dt_locations_delete_own"
  ON dt_locations FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE dt_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_entries_select_own" ON dt_entries;
CREATE POLICY "dt_entries_select_own"
  ON dt_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_entries_insert_own" ON dt_entries;
CREATE POLICY "dt_entries_insert_own"
  ON dt_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_entries_update_own" ON dt_entries;
CREATE POLICY "dt_entries_update_own"
  ON dt_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dt_entries_delete_own" ON dt_entries;
CREATE POLICY "dt_entries_delete_own"
  ON dt_entries FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE dt_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_notifications_select_opt_in" ON dt_notifications;
CREATE POLICY "dt_notifications_select_opt_in"
  ON dt_notifications FOR SELECT
  USING (
    (SELECT leaderboard_opt_in FROM dt_users WHERE id = auth.uid()) = TRUE
  );

-- Sync dt_locations.count from dt_entries
CREATE OR REPLACE FUNCTION dt_sync_location_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dt_locations
  SET count = (
    SELECT COUNT(*)
    FROM dt_entries
    WHERE dt_entries.location_id = COALESCE(NEW.location_id, OLD.location_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.location_id, OLD.location_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dt_sync_count_on_insert ON dt_entries;
CREATE TRIGGER dt_sync_count_on_insert
  AFTER INSERT ON dt_entries
  FOR EACH ROW
  EXECUTE FUNCTION dt_sync_location_count();

DROP TRIGGER IF EXISTS dt_sync_count_on_delete ON dt_entries;
CREATE TRIGGER dt_sync_count_on_delete
  AFTER DELETE ON dt_entries
  FOR EACH ROW
  EXECUTE FUNCTION dt_sync_location_count();

-- ============================================================================
-- Notifications: create dt_notifications when qualifying dt_entries are inserted
-- ============================================================================
CREATE OR REPLACE FUNCTION dt_notify_on_entry_insert()
RETURNS TRIGGER AS $$
DECLARE
  u_opt_in BOOLEAN;
  u_first TEXT;
  u_last TEXT;
  loc_name TEXT;
  entry_count BIGINT;
  total_2026 BIGINT;
  ghost_2026 BIGINT;
  messy_2026 BIGINT;
  liquid_2026 BIGINT;
  explosive_2026 BIGINT;
  prev_max_single_day BIGINT;
  actor_today BIGINT;
  dump_date DATE;
  location_count_at_loc BIGINT;
  total_wipe_count BIGINT;
  total_wipe_prev BIGINT;
  milestone_m BIGINT;
BEGIN
  SELECT u.leaderboard_opt_in, u.first_name, u.last_name
  INTO u_opt_in, u_first, u_last
  FROM dt_users u
  WHERE u.id = NEW.user_id;

  IF NOT u_opt_in OR u_first IS NULL OR u_last IS NULL OR TRIM(COALESCE(u_first, '')) = '' OR TRIM(COALESCE(u_last, '')) = '' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO entry_count FROM dt_entries WHERE location_id = NEW.location_id;
  SELECT location_name INTO loc_name FROM dt_locations WHERE id = NEW.location_id;
  IF entry_count = 1 AND loc_name IS NOT NULL THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'first_dump_at_location', NEW.user_id, jsonb_build_object('location_name', loc_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'first_dump_at_location'
        AND n.payload->>'location_name' = loc_name
    );
  END IF;
  IF loc_name IS NOT NULL THEN
    SELECT COUNT(*) INTO location_count_at_loc
    FROM dt_entries de
    INNER JOIN dt_locations d ON d.id = de.location_id
    WHERE de.user_id = NEW.user_id AND d.location_name = loc_name;
    IF location_count_at_loc > 0 AND location_count_at_loc % 50 = 0 THEN
      INSERT INTO dt_notifications (type, actor_user_id, payload)
      SELECT 'milestone_location_50', NEW.user_id, jsonb_build_object('location_name', loc_name, 'milestone_number', location_count_at_loc)
      WHERE NOT EXISTS (
        SELECT 1 FROM dt_notifications n
        WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_location_50'
          AND n.payload->>'location_name' = loc_name
          AND (n.payload->>'milestone_number')::BIGINT = location_count_at_loc
      );
    END IF;
  END IF;

  SELECT COUNT(*) INTO total_2026
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id
    AND EXTRACT(YEAR FROM (de.created_at AT TIME ZONE 'America/New_York')) = 2026;

  SELECT COUNT(*) INTO ghost_2026
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id AND de.ghost_wipe = TRUE
    AND EXTRACT(YEAR FROM (de.created_at AT TIME ZONE 'America/New_York')) = 2026;

  SELECT COUNT(*) INTO messy_2026
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id AND de.messy_dump = TRUE
    AND EXTRACT(YEAR FROM (de.created_at AT TIME ZONE 'America/New_York')) = 2026;

  SELECT COUNT(*) INTO liquid_2026
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id AND de.liquid_dump = TRUE
    AND EXTRACT(YEAR FROM (de.created_at AT TIME ZONE 'America/New_York')) = 2026;

  SELECT COUNT(*) INTO explosive_2026
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id AND de.explosive_dump = TRUE
    AND EXTRACT(YEAR FROM (de.created_at AT TIME ZONE 'America/New_York')) = 2026;

  IF ghost_2026 > 0 AND ghost_2026 % 10 = 0 THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'milestone_ghost_wipe', NEW.user_id, jsonb_build_object('milestone_number', ghost_2026)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_ghost_wipe'
        AND (n.payload->>'milestone_number')::BIGINT = ghost_2026
    );
  END IF;
  IF messy_2026 > 0 AND messy_2026 % 10 = 0 THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'milestone_messy_dump', NEW.user_id, jsonb_build_object('milestone_number', messy_2026)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_messy_dump'
        AND (n.payload->>'milestone_number')::BIGINT = messy_2026
    );
  END IF;
  IF liquid_2026 > 0 AND liquid_2026 % 10 = 0 THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'milestone_liquid_dump', NEW.user_id, jsonb_build_object('milestone_number', liquid_2026)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_liquid_dump'
        AND (n.payload->>'milestone_number')::BIGINT = liquid_2026
    );
  END IF;
  IF explosive_2026 > 0 AND explosive_2026 % 10 = 0 THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'milestone_explosive_dump', NEW.user_id, jsonb_build_object('milestone_number', explosive_2026)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_explosive_dump'
        AND (n.payload->>'milestone_number')::BIGINT = explosive_2026
    );
  END IF;
  IF total_2026 > 0 AND total_2026 % 100 = 0 THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'milestone_total', NEW.user_id, jsonb_build_object('milestone_number', total_2026)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_total'
        AND (n.payload->>'milestone_number')::BIGINT = total_2026
    );
  END IF;

  -- Wipes milestone: fire when user crosses a 500 boundary (e.g. 494 -> 506 triggers 500)
  SELECT COALESCE(SUM(COALESCE(de.wipes, 0)), 0)::BIGINT INTO total_wipe_count
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id;
  total_wipe_prev := total_wipe_count - COALESCE(NEW.wipes, 0);
  milestone_m := 500;
  WHILE milestone_m <= total_wipe_count LOOP
    IF total_wipe_prev < milestone_m THEN
      INSERT INTO dt_notifications (type, actor_user_id, payload)
      SELECT 'milestone_wipes', NEW.user_id, jsonb_build_object('milestone_number', milestone_m)
      WHERE NOT EXISTS (
        SELECT 1 FROM dt_notifications n
        WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_wipes'
          AND (n.payload->>'milestone_number')::BIGINT = milestone_m
      );
    END IF;
    milestone_m := milestone_m + 500;
  END LOOP;

  dump_date := (NEW.created_at AT TIME ZONE 'America/New_York')::DATE;

  SELECT COALESCE(MAX(daily_count), 0) INTO prev_max_single_day
  FROM (
    SELECT de.user_id, DATE(de.created_at AT TIME ZONE 'America/New_York') AS d, COUNT(*)::BIGINT AS daily_count
    FROM dt_entries de
    INNER JOIN dt_users u ON u.id = de.user_id AND u.leaderboard_opt_in = TRUE
    WHERE de.id != NEW.id
    GROUP BY de.user_id, DATE(de.created_at AT TIME ZONE 'America/New_York')
  ) sub;

  SELECT COUNT(*)::BIGINT INTO actor_today
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id
    AND DATE(de.created_at AT TIME ZONE 'America/New_York') = dump_date;

  IF actor_today > prev_max_single_day THEN
    INSERT INTO dt_notifications (type, actor_user_id, payload)
    SELECT 'single_day_record_broken', NEW.user_id, jsonb_build_object('dump_count', actor_today, 'record_date', dump_date::TEXT)
    WHERE NOT EXISTS (
      SELECT 1 FROM dt_notifications n
      WHERE n.actor_user_id = NEW.user_id AND n.type = 'single_day_record_broken'
        AND n.payload->>'record_date' = dump_date::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dt_z_notify_on_entry_insert ON dt_entries;
CREATE TRIGGER dt_z_notify_on_entry_insert
  AFTER INSERT ON dt_entries
  FOR EACH ROW
  EXECUTE FUNCTION dt_notify_on_entry_insert();

-- Wipes milestone on UPDATE when wipes column changes (fire when crossing 500 boundary)
CREATE OR REPLACE FUNCTION dt_check_wipes_milestone_on_update()
RETURNS TRIGGER AS $$
DECLARE
  total_wipe_count BIGINT;
  total_wipe_prev BIGINT;
  milestone_m BIGINT;
BEGIN
  SELECT COALESCE(SUM(COALESCE(de.wipes, 0)), 0)::BIGINT INTO total_wipe_count
  FROM dt_entries de
  WHERE de.user_id = NEW.user_id;
  total_wipe_prev := total_wipe_count - COALESCE(NEW.wipes, 0) + COALESCE(OLD.wipes, 0);
  milestone_m := 500;
  WHILE milestone_m <= total_wipe_count LOOP
    IF total_wipe_prev < milestone_m THEN
      INSERT INTO dt_notifications (type, actor_user_id, payload)
      SELECT 'milestone_wipes', NEW.user_id, jsonb_build_object('milestone_number', milestone_m)
      WHERE NOT EXISTS (
        SELECT 1 FROM dt_notifications n
        WHERE n.actor_user_id = NEW.user_id AND n.type = 'milestone_wipes'
          AND (n.payload->>'milestone_number')::BIGINT = milestone_m
      );
    END IF;
    milestone_m := milestone_m + 500;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dt_notify_on_entry_update_wipes ON dt_entries;
CREATE TRIGGER dt_notify_on_entry_update_wipes
  AFTER UPDATE ON dt_entries
  FOR EACH ROW
  WHEN (OLD.wipes IS DISTINCT FROM NEW.wipes)
  EXECUTE FUNCTION dt_check_wipes_milestone_on_update();

-- Note: dt_users.id matches auth.users.id. The app creates a dt_users row when a user registers (trigger or dt_ensure_user_exists).

-- ============================================================================
-- Leaderboard Query Functions
-- ============================================================================
-- These functions are used by the leaderboard feature to query user statistics

-- Function to get most dumps in current day
CREATE OR REPLACE FUNCTION dt_get_leaderboard_daily()
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
  FROM dt_users u
  INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_weekly()
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
  FROM dt_users u
  INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_2026()
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
  FROM dt_users u
  INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_ghost_wipes()
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
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_messy_dumps()
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
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_liquid_dumps()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  liquid_dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH liquid_dump_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(de.id)::BIGINT as liquid_dump_count
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
      AND de.liquid_dump = TRUE
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(de.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(ldc2.liquid_dump_count), 0) as highest_count
    FROM liquid_dump_counts ldc2
  )
  SELECT 
    ldc.user_id,
    ldc.first_name,
    ldc.last_name,
    ldc.liquid_dump_count AS liquid_dump_count
  FROM liquid_dump_counts ldc
  CROSS JOIN top_count tc
  WHERE tc.highest_count > 0
    AND ldc.liquid_dump_count = tc.highest_count
  ORDER BY (ldc.liquid_dump_count) DESC, ldc.first_name, ldc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION dt_get_leaderboard_explosive_dumps()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  explosive_dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH explosive_dump_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(de.id)::BIGINT as explosive_dump_count
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
      AND de.explosive_dump = TRUE
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(de.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(edc2.explosive_dump_count), 0) as highest_count
    FROM explosive_dump_counts edc2
  )
  SELECT 
    edc.user_id,
    edc.first_name,
    edc.last_name,
    edc.explosive_dump_count AS explosive_dump_count
  FROM explosive_dump_counts edc
  CROSS JOIN top_count tc
  WHERE tc.highest_count > 0
    AND edc.explosive_dump_count = tc.highest_count
  ORDER BY (edc.explosive_dump_count) DESC, edc.first_name, edc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Max wipes in a single dump (only entries with wipes set, leaderboard_opt_in)
CREATE OR REPLACE FUNCTION dt_get_leaderboard_max_wipes()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  max_wipes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_max AS (
    SELECT
      de.user_id,
      MAX(de.wipes)::BIGINT AS max_wipes
    FROM dt_entries de
    INNER JOIN dt_users u ON u.id = de.user_id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND TRIM(COALESCE(u.first_name, '')) != ''
      AND TRIM(COALESCE(u.last_name, '')) != ''
      AND de.wipes IS NOT NULL
      AND de.wipes > 0
    GROUP BY de.user_id
  ),
  global_max AS (
    SELECT COALESCE(MAX(um.max_wipes), 0) AS m FROM user_max um
  )
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    um.max_wipes
  FROM dt_users u
  INNER JOIN user_max um ON um.user_id = u.id
  CROSS JOIN global_max gm
  WHERE gm.m > 0 AND um.max_wipes = gm.m
  ORDER BY um.max_wipes DESC, u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Most 1-wipe dumps (count of entries where wipes = 1)
CREATE OR REPLACE FUNCTION dt_get_leaderboard_one_wipe_dumps()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  one_wipe_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH one_wipe_counts AS (
    SELECT
      u.id AS user_id,
      u.first_name,
      u.last_name,
      COUNT(de.id)::BIGINT AS one_wipe_count
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND TRIM(COALESCE(u.first_name, '')) != ''
      AND TRIM(COALESCE(u.last_name, '')) != ''
      AND de.wipes = 1
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(de.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(owc2.one_wipe_count), 0) AS highest FROM one_wipe_counts owc2
  )
  SELECT
    owc.user_id,
    owc.first_name,
    owc.last_name,
    owc.one_wipe_count
  FROM one_wipe_counts owc
  CROSS JOIN top_count tc
  WHERE tc.highest > 0 AND owc.one_wipe_count = tc.highest
  ORDER BY owc.one_wipe_count DESC, owc.first_name, owc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION dt_get_leaderboard_single_day_record()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  record_date DATE,
  dump_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_counts AS (
    -- Calculate dumps per user per day
    SELECT 
      de.user_id,
      u.first_name,
      u.last_name,
      DATE(de.created_at AT TIME ZONE 'America/New_York') AS dump_date,
      COUNT(*)::BIGINT AS dumps_count
    FROM dt_entries de
    INNER JOIN dt_users u ON u.id = de.user_id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
    GROUP BY de.user_id, u.first_name, u.last_name, DATE(de.created_at AT TIME ZONE 'America/New_York')
  ),
  max_count AS (
    -- Find the maximum dumps in a day across all users
    SELECT MAX(dumps_count) AS record_count
    FROM daily_counts
  ),
  record_holders AS (
    -- Find all user-date combinations that match the record
    SELECT 
      dc.user_id,
      dc.first_name,
      dc.last_name,
      dc.dump_date,
      dc.dumps_count,
      ROW_NUMBER() OVER (PARTITION BY dc.user_id ORDER BY dc.dump_date ASC) AS rn
    FROM daily_counts dc
    CROSS JOIN max_count mc
    WHERE dc.dumps_count = mc.record_count
  )
  -- Return only the first occurrence for each user
  SELECT 
    rh.user_id,
    rh.first_name,
    rh.last_name,
    rh.dump_date AS record_date,
    rh.dumps_count AS dump_count
  FROM record_holders rh
  WHERE rh.rn = 1
  ORDER BY rh.dump_date ASC, rh.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION dt_get_leaderboard_single_location_record()
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
  FROM dt_users u
  INNER JOIN dt_locations d ON d.user_id = u.id
  INNER JOIN dt_entries de ON de.location_id = d.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_avg_per_day()
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
    FROM dt_users u
    INNER JOIN dt_entries de ON de.user_id = u.id
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

CREATE OR REPLACE FUNCTION dt_get_leaderboard_distinct_locations()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  distinct_location_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH distinct_location_counts AS (
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(DISTINCT d.id)::BIGINT as distinct_location_count
    FROM dt_users u
    INNER JOIN dt_locations d ON d.user_id = u.id
    INNER JOIN dt_entries de ON de.location_id = d.id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND u.first_name != ''
      AND u.last_name != ''
    GROUP BY u.id, u.first_name, u.last_name
    HAVING COUNT(DISTINCT d.id) > 0
  ),
  top_count AS (
    SELECT COALESCE(MAX(dlc2.distinct_location_count), 0) as highest_count
    FROM distinct_location_counts dlc2
  )
  SELECT 
    dlc.user_id,
    dlc.first_name,
    dlc.last_name,
    dlc.distinct_location_count AS distinct_location_count
  FROM distinct_location_counts dlc
  CROSS JOIN top_count tc
  WHERE tc.highest_count > 0
    AND dlc.distinct_location_count = tc.highest_count
  ORDER BY (dlc.distinct_location_count) DESC, dlc.first_name, dlc.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dt_get_leaderboard_daily() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_weekly() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_2026() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_ghost_wipes() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_messy_dumps() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_liquid_dumps() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_explosive_dumps() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_max_wipes() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_one_wipe_dumps() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_single_day_record() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_single_location_record() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_avg_per_day() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_distinct_locations() TO authenticated;

-- Notifications feed RPC (opt-in users only)
CREATE OR REPLACE FUNCTION dt_get_notifications(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  first_name TEXT,
  last_name TEXT
) AS $$
BEGIN
  IF NOT (SELECT COALESCE(leaderboard_opt_in, FALSE) FROM dt_users WHERE dt_users.id = auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.payload,
    n.created_at,
    u.first_name,
    u.last_name
  FROM dt_notifications n
  INNER JOIN dt_users u ON u.id = n.actor_user_id
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dt_get_notifications(INT) TO authenticated;

