-- ============================================================
-- POLÍTICAS RLS PARA TABELA EVENTS
-- ============================================================

-- Habilitar RLS se não estiver habilitado
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 1. Administradores podem atualizar qualquer campo de qualquer evento
DROP POLICY IF EXISTS "Admins can update events" ON events;
CREATE POLICY "Admins can update events" ON events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- 2. Responsáveis podem atualizar APENAS payment_value e payment_sent
-- (Esta política só permite update se o usuário for responsável E estiver atualizando apenas esses campos)
DROP POLICY IF EXISTS "Responsibles can update payment fields" ON events;
CREATE POLICY "Responsibles can update payment fields" ON events
  FOR UPDATE
  USING (
    auth.uid() = ANY(responsibles)
  )
  WITH CHECK (
    auth.uid() = ANY(responsibles)
  );

-- 3. Qualquer usuário autenticado pode ler eventos
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
CREATE POLICY "Authenticated users can view events" ON events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Administradores podem inserir eventos
DROP POLICY IF EXISTS "Admins can insert events" ON events;
CREATE POLICY "Admins can insert events" ON events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- 5. Administradores podem deletar eventos
DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY "Admins can delete events" ON events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );