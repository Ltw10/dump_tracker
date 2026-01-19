-- Migration script to add location tracking fields
-- Run this SQL in your Supabase SQL Editor if you have an existing database

-- Add location_tracking_opt_in to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS location_tracking_opt_in BOOLEAN DEFAULT FALSE;

-- Add comment to document the location_tracking_opt_in field
COMMENT ON COLUMN users.location_tracking_opt_in IS 'Whether the user has opted in to location tracking features';

-- Add location tracking fields to dumps table
ALTER TABLE dumps 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8),
ADD COLUMN IF NOT EXISTS location_data_provided BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS location_data_declined BOOLEAN DEFAULT FALSE;

-- Add comments to document location tracking fields
COMMENT ON COLUMN dumps.address IS 'Street address or location description provided by user';
COMMENT ON COLUMN dumps.latitude IS 'Latitude coordinate if GPS location was provided';
COMMENT ON COLUMN dumps.longitude IS 'Longitude coordinate if GPS location was provided';
COMMENT ON COLUMN dumps.location_data_provided IS 'Whether specific location data (address or GPS) has been provided';
COMMENT ON COLUMN dumps.location_data_declined IS 'Whether user has declined to provide location data for this location';

