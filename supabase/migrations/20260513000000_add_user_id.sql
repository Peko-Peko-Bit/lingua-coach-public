-- ============================================================
-- Migration: Add user_id columns for Supabase Auth (Phase 1 prep)
-- ============================================================
-- Adds nullable user_id columns to user-data tables.
-- NULL = anonymous / pre-auth row (backward-compatible).
-- ============================================================


-- threads
ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS threads_user_id_idx ON threads(user_id);

-- vocabulary
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vocabulary_user_id_idx ON vocabulary(user_id);

-- grammar_progress (currently session_id-based; user_id added alongside for future auth)
ALTER TABLE grammar_progress
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS grammar_progress_user_id_idx ON grammar_progress(user_id);

-- grammar_settings (same pattern as grammar_progress)
ALTER TABLE grammar_settings
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS grammar_settings_user_id_idx ON grammar_settings(user_id);
