-- Add new columns for enhanced case data
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS organ_system text;

-- Optional: Migrate existing image_url to image_urls for consistency
-- UPDATE public.cases SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);
