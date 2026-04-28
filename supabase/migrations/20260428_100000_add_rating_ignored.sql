-- Add ignored_at column to ratings table to track ignored events
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS ignored_at TIMESTAMPTZ;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ratings_ignored_at ON ratings(user_id, ignored_at) WHERE ignored_at IS NOT NULL;