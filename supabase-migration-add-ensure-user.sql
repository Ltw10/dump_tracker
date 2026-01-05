-- Migration: Add ensure_user_exists function
-- Run this SQL in your Supabase SQL Editor to fix the foreign key constraint issue

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

