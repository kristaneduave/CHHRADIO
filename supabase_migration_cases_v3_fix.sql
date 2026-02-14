-- Fix: Add missing columns for upload feature
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS patient_initials text,
ADD COLUMN IF NOT EXISTS patient_age text,
ADD COLUMN IF NOT EXISTS patient_sex text;
