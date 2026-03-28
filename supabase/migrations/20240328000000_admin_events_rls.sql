-- Permitir que Administradores atualizem qualquer Janta (events)
DROP POLICY IF EXISTS "Admins can update events" ON events;
CREATE POLICY "Admins can update events" ON events
FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Permitir que Administradores deletem qualquer Janta (events)
DROP POLICY IF EXISTS "Admins can delete events" ON events;
CREATE POLICY "Admins can delete events" ON events
FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);
