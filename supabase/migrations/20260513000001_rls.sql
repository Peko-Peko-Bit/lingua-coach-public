-- ============================================================
-- Migration: Row Level Security for LinguaCoach
-- ============================================================
-- Phase 1 (run now): block anon key on user-data tables;
--   allow public SELECT on curriculum tables.
-- Phase 2 (uncomment when Auth is enabled): per-user owner policies.
--
-- service_role (used server-side) bypasses RLS automatically.
-- ============================================================


-- ============================================================
-- STEP 1: Enable RLS on all tables
-- ============================================================

ALTER TABLE threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_units    ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_topics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 2: Phase 1 policies — deny anon on user-data tables
-- ============================================================

-- threads
DROP POLICY IF EXISTS "anon_no_access_threads" ON threads;
CREATE POLICY "anon_no_access_threads"
  ON threads FOR ALL TO anon USING (false);

-- messages
DROP POLICY IF EXISTS "anon_no_access_messages" ON messages;
CREATE POLICY "anon_no_access_messages"
  ON messages FOR ALL TO anon USING (false);

-- vocabulary
DROP POLICY IF EXISTS "anon_no_access_vocabulary" ON vocabulary;
CREATE POLICY "anon_no_access_vocabulary"
  ON vocabulary FOR ALL TO anon USING (false);

-- grammar_progress
DROP POLICY IF EXISTS "anon_no_access_grammar_progress" ON grammar_progress;
CREATE POLICY "anon_no_access_grammar_progress"
  ON grammar_progress FOR ALL TO anon USING (false);

-- grammar_settings
DROP POLICY IF EXISTS "anon_no_access_grammar_settings" ON grammar_settings;
CREATE POLICY "anon_no_access_grammar_settings"
  ON grammar_settings FOR ALL TO anon USING (false);


-- ============================================================
-- STEP 3: Public curriculum tables — allow SELECT for all roles
-- ============================================================
-- grammar_units and grammar_topics are read-only curriculum content.
-- No user_id needed; anyone (including anon) may read them.

DROP POLICY IF EXISTS "public_read_grammar_units" ON grammar_units;
CREATE POLICY "public_read_grammar_units"
  ON grammar_units FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_grammar_topics" ON grammar_topics;
CREATE POLICY "public_read_grammar_topics"
  ON grammar_topics FOR SELECT TO anon, authenticated USING (true);


-- ============================================================
-- [PHASE 2] Future policies — uncomment when Auth is enabled
-- ============================================================
-- When Supabase Auth is wired up:
--   1. Remove the "anon_no_access_*" policies above.
--   2. Uncomment and run the policies below.
--   3. Backfill user_id for any existing rows you want to migrate.
--
-- -- threads: owner access only
-- DROP POLICY IF EXISTS "owner_threads" ON threads;
-- CREATE POLICY "owner_threads"
--   ON threads FOR ALL TO authenticated
--   USING      (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- -- messages: accessible when parent thread belongs to user
-- DROP POLICY IF EXISTS "owner_messages" ON messages;
-- CREATE POLICY "owner_messages"
--   ON messages FOR ALL TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM threads t
--       WHERE t.id = messages.thread_id
--         AND t.user_id = auth.uid()
--     )
--   );
--
-- -- vocabulary: owner access only
-- DROP POLICY IF EXISTS "owner_vocabulary" ON vocabulary;
-- CREATE POLICY "owner_vocabulary"
--   ON vocabulary FOR ALL TO authenticated
--   USING      (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- -- grammar_progress: owner access, or anonymous via session_id (no user_id)
-- DROP POLICY IF EXISTS "owner_grammar_progress" ON grammar_progress;
-- CREATE POLICY "owner_grammar_progress"
--   ON grammar_progress FOR ALL TO authenticated
--   USING (auth.uid() = user_id OR user_id IS NULL)
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
--
-- -- grammar_settings: same as grammar_progress
-- DROP POLICY IF EXISTS "owner_grammar_settings" ON grammar_settings;
-- CREATE POLICY "owner_grammar_settings"
--   ON grammar_settings FOR ALL TO authenticated
--   USING (auth.uid() = user_id OR user_id IS NULL)
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
-- ============================================================
