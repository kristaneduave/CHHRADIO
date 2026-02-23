ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'interesting_case',
ADD COLUMN IF NOT EXISTS radiologic_clinchers text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_submission_type_check'
  ) THEN
    ALTER TABLE public.cases
    ADD CONSTRAINT cases_submission_type_check
    CHECK (submission_type IN ('interesting_case', 'rare_pathology'));
  END IF;
END $$;
