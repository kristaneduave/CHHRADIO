ALTER TABLE public.cases
DROP CONSTRAINT IF EXISTS cases_submission_type_check;

ALTER TABLE public.cases
ADD CONSTRAINT cases_submission_type_check
CHECK (submission_type IN ('interesting_case', 'rare_pathology', 'aunt_minnie'));

