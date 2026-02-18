-- Create table for storing consultant cover overrides
CREATE TABLE IF NOT EXISTS public.consultant_covers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slot_id TEXT NOT NULL, 
    cover_date DATE,
    doctor_name TEXT NOT NULL,
    scope TEXT DEFAULT 'All',
    informed BOOLEAN DEFAULT false,
    read_status TEXT DEFAULT 'none',
    informed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.consultant_covers ENABLE ROW LEVEL SECURITY;

-- Policy to allow all authenticated users to select
CREATE POLICY "Enable read/write for all users" ON public.consultant_covers
    FOR ALL USING (true) WITH CHECK (true);
