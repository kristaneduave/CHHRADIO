-- Create announcement_views table
CREATE TABLE IF NOT EXISTS public.announcement_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own views"
    ON public.announcement_views
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all views"
    ON public.announcement_views
    FOR SELECT
    USING (true);

-- Trigger to increment views count on announcements (optional, but good for performance if we keep views column)
-- For now, we will just count rows or update the views column manually in client if needed,
-- but a trigger is better. Let's start with just the table.
