-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('rotation', 'call', 'lecture', 'exam', 'leave', 'meeting', 'other')),
  location TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  assigned_to UUID REFERENCES auth.users(id), -- Nullable, if null it's a general event, if set it's assigned to a specific user
  is_all_day BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policies

-- Read: Everyone can read public events (assigned_to is null)
CREATE POLICY "Everyone can read public events"
  ON public.events
  FOR SELECT
  USING (assigned_to IS NULL);

-- Read: Users can read events assigned to them
CREATE POLICY "Users can read their own assignments"
  ON public.events
  FOR SELECT
  USING (auth.uid() = assigned_to);

-- Read: Creators can read their own created events (e.g. if they made a private event or a public one)
CREATE POLICY "Creators can read their own events"
  ON public.events
  FOR SELECT
  USING (auth.uid() = created_by);

-- Insert: Authenticated users can create events
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Update: Creators can update their own events
CREATE POLICY "Creators can update their own events"
  ON public.events
  FOR UPDATE
  USING (auth.uid() = created_by);

-- Delete: Creators can delete their own events
CREATE POLICY "Creators can delete their own events"
  ON public.events
  FOR DELETE
  USING (auth.uid() = created_by);
