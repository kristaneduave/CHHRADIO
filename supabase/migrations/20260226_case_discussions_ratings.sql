-- Migration to add comments and ratings for cases

CREATE TABLE IF NOT EXISTS public.case_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(case_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.case_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.case_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;

-- Ratings Policies
CREATE POLICY "Enable read access for all users on case_ratings" ON public.case_ratings FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on case_ratings" ON public.case_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id on case_ratings" ON public.case_ratings FOR UPDATE USING (auth.uid() = user_id);

-- Comments Policies
CREATE POLICY "Enable read access for all users on case_comments" ON public.case_comments FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on case_comments" ON public.case_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id on case_comments" ON public.case_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for users based on user_id on case_comments" ON public.case_comments FOR DELETE USING (auth.uid() = user_id);

-- Create views or indexes if necessary
CREATE INDEX IF NOT EXISTS idx_case_ratings_case_id ON public.case_ratings(case_id);
CREATE INDEX IF NOT EXISTS idx_case_comments_case_id ON public.case_comments(case_id);
