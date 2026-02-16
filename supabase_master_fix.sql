-- MASTER FIX: User Management & Admin Role Setup
-- This script safely reapplies all necessary policies and fixes potential permission loops.

-- 1. Create a Helper Function to safely check admin status (avoiding recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- 2. RESET POLICIES (Clear old or conflicting rules)
DROP POLICY IF EXISTS "Admins can do everything on announcements" ON announcements;
DROP POLICY IF EXISTS "Privileged users can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Privileged users can update announcements" ON announcements;
DROP POLICY IF EXISTS "Privileged users can delete announcements" ON announcements;

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile OR Admin can update any" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- 3. PROFILES: Allow everyone to READ profiles (critical for app to see roles)
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING ( true );

-- 4. PROFILES: Allow users to UPDATE only their own (or Admins can update ANY)
CREATE POLICY "Users can update own profile OR Admin can update any"
ON profiles FOR UPDATE
USING (
  auth.uid() = id OR is_admin()
)
WITH CHECK (
  auth.uid() = id OR is_admin()
);

-- 5. ANNOUNCEMENTS: Admins can do ANYTHING
CREATE POLICY "Admins can do everything on announcements"
ON announcements
FOR ALL
USING ( is_admin() )
WITH CHECK ( is_admin() );

-- 6. ANNOUNCEMENTS: Faculty/Consultants can create
CREATE POLICY "Faculty/Consultants can insert announcements"
ON announcements FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('faculty', 'consultant')
);

-- 7. ANNOUNCEMENTS: Faculty/Consultants can update/delete ONY their own
CREATE POLICY "Faculty/Consultants can managing own announcements"
ON announcements FOR ALL
USING (
  auth.role() = 'authenticated' AND 
  author_id = auth.uid() AND
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('faculty', 'consultant')
);

-- 8. FORCE ADMIN ROLE (Case Insensitive Fix)
UPDATE profiles
SET role = 'admin'
FROM auth.users
WHERE profiles.id = auth.users.id
AND auth.users.email ILIKE 'kristaneduave@gmail.com';

-- 9. VERIFY
SELECT auth.users.email, profiles.role
FROM profiles
JOIN auth.users ON profiles.id = auth.users.id
WHERE auth.users.email ILIKE 'kristaneduave@gmail.com';
