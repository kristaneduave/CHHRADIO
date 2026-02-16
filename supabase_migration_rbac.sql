-- Add role column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'resident' CHECK (role IN ('admin', 'faculty', 'consultant', 'resident'));

-- Update existing profiles to have a default role if null (though default handles new ones)
UPDATE profiles SET role = 'resident' WHERE role IS NULL;

-- Policy: Admin can do everything on announcements
CREATE POLICY "Admins can do everything on announcements"
  ON announcements
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy: Faculty and Consultants can insert their own announcements
CREATE POLICY "Faculty and Consultants can insert announcements"
  ON announcements
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('faculty', 'consultant')
  );

-- Policy: Faculty and Consultants can update/delete their own announcements
-- Note: 'Users can update their own announcements' policy might already exist from previous migration.
-- We should verify if we need to drop it or if it covers this.
-- The previous policy was: "Users can update their own announcements" using (auth.uid() = author_id)
-- This is still valid for Faculty/Consultants editing their own.
-- However, we want to RESTRICT Residents from doing this if they somehow managed to insert one (which they shouldn't be able to).
-- But simpler is to just rely on the Insert policy to prevent them from creating.
-- If they can't create, they can't be author_id (usually).

-- Let's Refine Policies. Dropping old ones to be safe and defining clear RBAC ones is better practice.

DROP POLICY IF EXISTS "Authenticated users can insert announcements" ON announcements;
DROP POLICY IF EXISTS "Users can update their own announcements" ON announcements;

-- Re-create stricter policies

-- 1. View: Everyone can view (already exists: "Announcements are viewable by everyone")

-- 2. Insert: Only Admin, Faculty, Consultant
CREATE POLICY "Privileged users can insert announcements"
  ON announcements
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'faculty', 'consultant')
  );

-- 3. Update: Admin (any), Author (if privileged)
CREATE POLICY "Privileged users can update announcements"
  ON announcements
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
      ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('faculty', 'consultant') AND author_id = auth.uid())
    )
  );

-- 4. Delete: Admin (any), Author (if privileged)
CREATE POLICY "Privileged users can delete announcements"
  ON announcements
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' OR
      ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('faculty', 'consultant') AND author_id = auth.uid())
    )
  );
