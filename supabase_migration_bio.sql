-- Add bio column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio text;

-- Verify policy compatibility (existing policies allow update/insert for owner)
-- Ensure 'bio' is included in the 'profiles' RLS policies if they restrict specific columns (standard policies usually cover all columns)

-- Optional: Add a comment
COMMENT ON COLUMN public.profiles.bio IS 'User biography or role description';
