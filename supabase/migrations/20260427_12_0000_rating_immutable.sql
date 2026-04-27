-- ============================================================
-- Migration: Remove UPDATE policy from ratings (immutable ratings)
-- Data: 2026-04-27
-- ============================================================

DROP POLICY IF EXISTS "ratings_update" ON ratings;
DROP POLICY IF EXISTS "ratings_allow_update" ON ratings;

CREATE POLICY "ratings_insert_only"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: only allow SELECT for reading (no UPDATE allowed)
DROP POLICY IF EXISTS "ratings_select" ON ratings;
CREATE POLICY "ratings_select"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);