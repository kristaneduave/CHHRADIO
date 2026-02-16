ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS links JSONB[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS icon TEXT;

UPDATE announcements SET links = '{}' WHERE links IS NULL;
