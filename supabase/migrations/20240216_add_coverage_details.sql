-- Add coverage_details column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS coverage_details JSONB DEFAULT '[]'::JSONB;

-- Comment on column
COMMENT ON COLUMN public.events.coverage_details IS 'Array of coverage objects: [{ user_id: UUID, modality: String }]';
