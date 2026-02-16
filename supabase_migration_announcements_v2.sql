-- Add attachments and external_link columns to announcements table
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS attachments JSONB[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS external_link TEXT DEFAULT NULL;

-- Explanation:
-- attachments: Array of JSONB objects, e.g., [{"url": "...", "type": "image/png", "name": "foo.png", "size": 1024}]
-- external_link: Simple text column for URLs
