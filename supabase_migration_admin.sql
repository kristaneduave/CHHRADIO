-- 1. Grant Admin Role to specific user
UPDATE profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'kristaneduave@gmail.com');

-- 2. Allow Admins to update ANY profile (specifically the 'role' column, but generally updates)
-- First, drop existing update policy if it restricts to 'own' profile only.
-- The default Supabase "Users can update own profile" usually looks like: using ( auth.uid() = id )
-- We want: using ( auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' )

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile OR Admin can update any"
  ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    auth.uid() = id OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Allow Admins to view ALL profiles (likely already enabled by "Public profiles are viewable by everyone" or similar)
-- But ensuring it exists.
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
