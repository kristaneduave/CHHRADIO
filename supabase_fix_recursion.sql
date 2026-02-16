-- FIX: Resolve Infinite Recursion in RLS Policies

-- 1. Create a SECURE function to check if a user is an admin.
-- This function runs with "SECURITY DEFINER" privileges, meaning it bypasses RLS
-- to read the role safely without causing a loop.
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

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile OR Admin can update any" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 3. Re-create the UPDATE policy using the safe function
CREATE POLICY "Users can update own profile OR Admin can update any"
  ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR is_admin()
  );

-- 4. Re-create the SELECT policy (Optional, but good for Admin power)
-- Users can usually see everyone via "Public profiles are viewable by everyone" (default).
-- We add this just to be sure Admins can definitely see everything even if other policies change.
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (
    is_admin()
  );
