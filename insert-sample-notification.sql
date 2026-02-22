-- Insert a notification for your newest location (most recent row in dumps).
-- Run this in the Supabase SQL Editor. Uses the latest dump so you see a real location name.

INSERT INTO notifications (type, actor_user_id, payload)
SELECT
  'first_dump_at_location',
  d.user_id,
  jsonb_build_object('location_name', d.location_name)
FROM dumps d
ORDER BY d.created_at DESC
LIMIT 1;

-- Optional: add a couple more sample notification types so you can see how they look in the app.
-- (Uses the same user as the newest dump.)

INSERT INTO notifications (type, actor_user_id, payload)
SELECT
  'milestone_ghost_wipe',
  d.user_id,
  jsonb_build_object('milestone_number', 10)
FROM dumps d
ORDER BY d.created_at DESC
LIMIT 1;

INSERT INTO notifications (type, actor_user_id, payload)
SELECT
  'milestone_total',
  d.user_id,
  jsonb_build_object('milestone_number', 100)
FROM dumps d
ORDER BY d.created_at DESC
LIMIT 1;
