-- Migration: Add dump_entries table to track individual dumps
-- Run this SQL in your Supabase SQL Editor

-- Create dump_entries table to track individual dump occurrences
CREATE TABLE IF NOT EXISTS dump_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dump_id UUID NOT NULL REFERENCES dumps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on dump_id for faster queries
CREATE INDEX IF NOT EXISTS idx_dump_entries_dump_id ON dump_entries(dump_id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_dump_entries_user_id ON dump_entries(user_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_dump_entries_created_at ON dump_entries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE dump_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dump_entries table
CREATE POLICY "Users can view own dump entries"
  ON dump_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dump entries"
  ON dump_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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
CREATE TRIGGER sync_count_on_insert
  AFTER INSERT ON dump_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_dump_count();

-- Trigger to sync count when entries are deleted
CREATE TRIGGER sync_count_on_delete
  AFTER DELETE ON dump_entries
  FOR EACH ROW
  EXECUTE FUNCTION sync_dump_count();

-- Migrate existing data: Create entries for existing counts
-- This creates one entry per existing count (approximation)
DO $$
DECLARE
  dump_record RECORD;
  i INTEGER;
BEGIN
  FOR dump_record IN SELECT id, user_id, count FROM dumps LOOP
    -- Create entries for existing count
    FOR i IN 1..dump_record.count LOOP
      INSERT INTO dump_entries (dump_id, user_id, created_at)
      VALUES (
        dump_record.id,
        dump_record.user_id,
        NOW() - (i * INTERVAL '1 hour') -- Space them out by hour for existing data
      );
    END LOOP;
  END LOOP;
END $$;

