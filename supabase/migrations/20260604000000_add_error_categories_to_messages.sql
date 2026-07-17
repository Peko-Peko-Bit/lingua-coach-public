-- Add error_categories TEXT[] column for multi-category grammar error logging
ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_categories TEXT[];
