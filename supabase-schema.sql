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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
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
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_user_exists() TO authenticated;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dumps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Users can only see and update their own record
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Note: User insertion is now handled by the trigger, so we don't need an INSERT policy
-- The trigger runs with SECURITY DEFINER, so it bypasses RLS
-- If you had an INSERT policy before, drop it with:
-- DROP POLICY IF EXISTS "Users can insert own profile" ON users;

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for dumps table
-- Users can only see their own dumps
CREATE POLICY "Users can view own dumps"
  ON dumps FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own dumps
CREATE POLICY "Users can insert own dumps"
  ON dumps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own dumps
CREATE POLICY "Users can update own dumps"
  ON dumps FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own dumps
CREATE POLICY "Users can delete own dumps"
  ON dumps FOR DELETE
  USING (auth.uid() = user_id);

-- Note: Since we're using Supabase Auth, the auth.uid() function
-- will automatically return the authenticated user's ID.
-- The users.id must match auth.users.id when creating accounts.
-- The app automatically creates a users record when a user registers via Supabase Auth.

