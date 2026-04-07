-- ============================================================
-- Migration: Aniversários + Sistema de Avaliação de Jantas
-- Data: 2025-04-07
-- ============================================================

-- 1. Campo de data de nascimento nos perfis
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- 2. Tabela de avaliações de jantas
CREATE TABLE IF NOT EXISTS ratings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment     TEXT    NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- 3. RLS — leitura pública para usuários autenticados
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select"
  ON ratings FOR SELECT
  TO authenticated
  USING (true);

-- 4. RLS — apenas quem esteve PRESENTE pode avaliar
CREATE POLICY "ratings_insert"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM attendances
      WHERE attendances.event_id = ratings.event_id
        AND attendances.user_id  = auth.uid()
        AND attendances.status   = 'Presente'
    )
  );

-- 5. RLS — dono pode atualizar sua avaliação
CREATE POLICY "ratings_update"
  ON ratings FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
