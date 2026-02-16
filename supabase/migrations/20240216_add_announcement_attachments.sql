-- Add attachments and external_link columns to announcements table

ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS attachments JSONB[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS external_link TEXT;

-- Update existing rows to have empty array if null (optional but good for consistency)
UPDATE announcements SET attachments = '{}' WHERE attachments IS NULL;
