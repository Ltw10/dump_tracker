-- Migration: add optional wipes to dt_entries, 500-wipes notifications, and leaderboard records.
-- Run this on existing databases that already have dt_entries.

ALTER TABLE dt_entries ADD COLUMN IF NOT EXISTS wipes INTEGER;

-- Update insert notification trigger to include 500-wipes milestone (add total_wipe_count and block)
-- Re-create the full function so existing DBs get the new logic.
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

GRANT EXECUTE ON FUNCTION dt_get_leaderboard_max_wipes() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_one_wipe_dumps() TO authenticated;
