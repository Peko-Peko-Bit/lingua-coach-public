-- Migration: Add last_reviewed_at column to vocabulary
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;
