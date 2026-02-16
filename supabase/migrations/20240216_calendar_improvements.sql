-- Add covered_by column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS covered_by UUID REFERENCES auth.users(id);

-- No new policies needed as existing RLS covers read/write for authenticated users on the table generally.
-- But we might want to ensure covered_by users can see their own coverage events?
-- The "Users can read events assigned to them" policy uses 'assigned_to'. 
-- Let's add a policy for coverage visibility.

CREATE POLICY "Users can read events they are covering"
  ON public.events
  FOR SELECT
  USING (auth.uid() = covered_by);
