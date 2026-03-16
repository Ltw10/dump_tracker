-- Migration: Leaderboard – replace "Most 1-Wipe Dumps" with "Most Total Wipes" and add "Top 3 wipes this week".
-- Run this on existing databases that already have the wipes column and leaderboard RPCs.

-- Most total wipes (sum of wipes across all entries, record = highest total)
CREATE OR REPLACE FUNCTION dt_get_leaderboard_total_wipes()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  total_wipes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_totals AS (
    SELECT
      de.user_id,
      SUM(COALESCE(de.wipes, 0))::BIGINT AS total_wipes
    FROM dt_entries de
    INNER JOIN dt_users u ON u.id = de.user_id
    WHERE u.leaderboard_opt_in = TRUE
      AND u.first_name IS NOT NULL
      AND u.last_name IS NOT NULL
      AND TRIM(COALESCE(u.first_name, '')) != ''
      AND TRIM(COALESCE(u.last_name, '')) != ''
    GROUP BY de.user_id
    HAVING SUM(COALESCE(de.wipes, 0)) > 0
  ),
  global_max AS (
    SELECT COALESCE(MAX(ut.total_wipes), 0) AS m FROM user_totals ut
  )
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    ut.total_wipes
  FROM dt_users u
  INNER JOIN user_totals ut ON ut.user_id = u.id
  CROSS JOIN global_max gm
  WHERE gm.m > 0 AND ut.total_wipes = gm.m
  ORDER BY ut.total_wipes DESC, u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top 3 in wipes for the current week (EST)
CREATE OR REPLACE FUNCTION dt_get_leaderboard_weekly_wipes_top3()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  weekly_wipes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    SUM(COALESCE(de.wipes, 0))::BIGINT AS weekly_wipes
  FROM dt_users u
  INNER JOIN dt_entries de ON de.user_id = u.id
  WHERE u.leaderboard_opt_in = TRUE
    AND u.first_name IS NOT NULL
    AND u.last_name IS NOT NULL
    AND TRIM(COALESCE(u.first_name, '')) != ''
    AND TRIM(COALESCE(u.last_name, '')) != ''
    AND de.created_at >= DATE_TRUNC('week', (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::DATE) AT TIME ZONE 'America/New_York'
  GROUP BY u.id, u.first_name, u.last_name
  HAVING SUM(COALESCE(de.wipes, 0)) > 0
  ORDER BY weekly_wipes DESC
  LIMIT 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dt_get_leaderboard_total_wipes() TO authenticated;
GRANT EXECUTE ON FUNCTION dt_get_leaderboard_weekly_wipes_top3() TO authenticated;

-- Optional: drop the old "Most 1-Wipe Dumps" function (frontend no longer uses it)
DROP FUNCTION IF EXISTS dt_get_leaderboard_one_wipe_dumps();
