-- FORCE update to Admin (Case Insensitive) and Verify Safely

-- 1. Remove strict constraint if exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add correct constraint
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'faculty', 'consultant', 'resident'));

-- 3. Update the role
UPDATE profiles
SET role = 'admin'
FROM auth.users
WHERE profiles.id = auth.users.id
AND auth.users.email ILIKE 'kristaneduave@gmail.com';

-- 4. Verify correctly (fixing the ambiguous column error)
SELECT auth.users.email, profiles.role
FROM profiles
JOIN auth.users ON profiles.id = auth.users.id
WHERE auth.users.email ILIKE 'kristaneduave@gmail.com';
