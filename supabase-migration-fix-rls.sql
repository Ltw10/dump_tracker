-- Migration: Fix RLS Policy Issue for User Registration
-- Run this SQL in your Supabase SQL Editor if you're getting RLS policy errors during registration

-- Drop the old INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

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

-- Drop trigger if it exists (for updates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to call the function when a new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: The trigger runs with SECURITY DEFINER, so it bypasses RLS
-- This allows the user record to be created automatically when a user signs up

