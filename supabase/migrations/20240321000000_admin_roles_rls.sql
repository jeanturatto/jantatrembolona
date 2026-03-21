-- Allow admins to update any profile (fixes AdminUserModal)
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Allow admins to manage attendances for any user
DROP POLICY IF EXISTS "Admins can insert attendances" ON attendances;
CREATE POLICY "Admins can insert attendances" ON attendances
FOR INSERT WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

DROP POLICY IF EXISTS "Admins can update attendances" ON attendances;
CREATE POLICY "Admins can update attendances" ON attendances
FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

DROP POLICY IF EXISTS "Admins can delete attendances" ON attendances;
CREATE POLICY "Admins can delete attendances" ON attendances
FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);
