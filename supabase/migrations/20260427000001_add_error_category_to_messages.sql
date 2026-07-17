-- Migration: Add error_category column to messages
-- Stores grammar error category when has_error=true

ALTER TABLE messages ADD COLUMN IF NOT EXISTS error_category TEXT;
