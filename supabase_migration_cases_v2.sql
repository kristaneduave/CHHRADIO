-- Add new columns to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS modality text,
ADD COLUMN IF NOT EXISTS anatomy_region text,
ADD COLUMN IF NOT EXISTS teaching_points text,
ADD COLUMN IF NOT EXISTS pearl text,
ADD COLUMN IF NOT EXISTS red_flags text,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Add check constraint for status
ALTER TABLE public.cases 
ADD CONSTRAINT cases_status_check CHECK (status IN ('draft', 'published'));

-- Update RLS policies
-- Drop existing policies if they conflict (or we can just add new ones)
DROP POLICY IF EXISTS "Users can view all cases" ON public.cases;
DROP POLICY IF EXISTS "Users can insert own cases" ON public.cases;
DROP POLICY IF EXISTS "Users can update own cases" ON public.cases;

-- Users can see their own drafts and ALL published cases
CREATE POLICY "Users can view published cases or own drafts" ON public.cases
FOR SELECT USING (
  status = 'published' OR 
  auth.uid() = created_by
);

-- Users can insert their own cases
CREATE POLICY "Users can insert own cases" ON public.cases
FOR INSERT WITH CHECK (
  auth.uid() = created_by
);

-- Users can update their own cases
CREATE POLICY "Users can update own cases" ON public.cases
FOR UPDATE USING (
  auth.uid() = created_by
);
