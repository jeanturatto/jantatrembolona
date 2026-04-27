-- ============================================================
-- Migration: Ratings immutable (insert + delete only, no update)
-- Data: 2026-04-27
-- ============================================================
-- 1. Remover UPDATE policies existentes
DROP POLICY IF EXISTS "ratings_udpate" ON ratings;
DROP POLICY IF EXISTS "ratings_update" ON ratings;
DROP POLICY IF EXISTS "ratings_allow_update" ON ratings;
DROP POLICY IF EXISTS "ratings_insert" ON ratings;
-- 2. INSERT: apenas o próprio usuário pode inserir
CREATE POLICY "ratings_insert_own"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- 3. SELECT: qualquer usuário autenticado pode ler
DROP POLICY IF EXISTS "ratings_select" ON ratings;
CREATE POLICY "ratings_select"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);

-- 4. DELETE: administradores podem apagar avaliações
CREATE POLICY "ratings_delete_admin"
  ON ratings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'admin')
    )
  );