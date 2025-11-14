-- Migration: Add last_activity field to poker_rooms table
-- Run this in your Supabase SQL Editor

ALTER TABLE poker_rooms 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rooms to have last_activity = created_at
UPDATE poker_rooms 
SET last_activity = created_at 
WHERE last_activity IS NULL;

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_poker_rooms_last_activity ON poker_rooms(last_activity);


