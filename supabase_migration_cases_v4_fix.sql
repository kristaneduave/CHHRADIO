-- Fix: Add more missing columns for upload feature
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS organ_system text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS clinical_history text,
ADD COLUMN IF NOT EXISTS difficulty text;
