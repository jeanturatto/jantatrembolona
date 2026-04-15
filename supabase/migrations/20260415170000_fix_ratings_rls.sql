-- ============================================================
-- Migration: Corrigir RLS de Avaliações (Ratings)
-- Data: 2026-04-15
-- ============================================================

-- Remover a verificação restrita de presença da inserção
DROP POLICY IF EXISTS "ratings_insert" ON ratings;
CREATE POLICY "ratings_insert"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

-- Habilitar Administradores a deletar QUALQUER avaliação
DROP POLICY IF EXISTS "Admins can delete ratings" ON ratings;
CREATE POLICY "Admins can delete ratings" 
  ON ratings FOR DELETE 
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN' OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Habilitar o próprio usuário a deletar sua avaliação (Opcional - mas caso queira deixar apenas para Admin, ignore)
-- Aqui mantemos restrito APENAS para Admin (conforme pedido: "somente ADMIN podem apagar").
