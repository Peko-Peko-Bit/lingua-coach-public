-- ============================================================
-- Migration: RLS Phase 2 for LinguaCoach — per-user owner policies
-- ============================================================
-- Activates the Phase 2 policies that were left commented out in
-- 20260513000001_rls.sql. Drops the Phase 1 "anon_no_access_*" policies
-- and replaces them with authenticated owner policies.
--
-- Idempotent: every policy is DROP IF EXISTS before CREATE, so this file
-- can be re-run safely.
--
-- service_role (used by all server-side API routes) bypasses RLS, so the
-- application keeps working unchanged; this is defense-in-depth for the
-- case where the anon key is ever used against these tables directly.
--
-- NOTE: apply manually in the Supabase SQL Editor (no migration runner is
-- wired up for this project). The shared `vocabulary` table is also covered
-- by LinguaGym's 010_rls_phase2.sql with an identical owner_vocabulary
-- definition — running either is safe; the last one wins.
-- ============================================================


-- ============================================================
-- STEP 1: Drop Phase 1 anon-block policies
-- ============================================================

DROP POLICY IF EXISTS "anon_no_access_threads"          ON threads;
DROP POLICY IF EXISTS "anon_no_access_messages"         ON messages;
DROP POLICY IF EXISTS "anon_no_access_vocabulary"       ON vocabulary;
DROP POLICY IF EXISTS "anon_no_access_grammar_progress" ON grammar_progress;
DROP POLICY IF EXISTS "anon_no_access_grammar_settings" ON grammar_settings;


-- ============================================================
-- STEP 2: Phase 2 owner policies (authenticated users only)
-- ============================================================

-- threads: owner access only
DROP POLICY IF EXISTS "owner_threads" ON threads;
CREATE POLICY "owner_threads"
  ON threads FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages: accessible when parent thread belongs to user
DROP POLICY IF EXISTS "owner_messages" ON messages;
CREATE POLICY "owner_messages"
  ON messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = messages.thread_id
        AND t.user_id = auth.uid()
    )
  );

-- vocabulary: owner access only
DROP POLICY IF EXISTS "owner_vocabulary" ON vocabulary;
CREATE POLICY "owner_vocabulary"
  ON vocabulary FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- grammar_progress: owner access, or anonymous rows with no user_id
DROP POLICY IF EXISTS "owner_grammar_progress" ON grammar_progress;
CREATE POLICY "owner_grammar_progress"
  ON grammar_progress FOR ALL TO authenticated
  USING      (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- grammar_settings: same as grammar_progress
DROP POLICY IF EXISTS "owner_grammar_settings" ON grammar_settings;
CREATE POLICY "owner_grammar_settings"
  ON grammar_settings FOR ALL TO authenticated
  USING      (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
