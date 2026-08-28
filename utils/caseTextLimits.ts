import { SubmissionType } from '../types';

export const CASE_TEXT_LIMITS: Record<
  SubmissionType,
  { findings: number; notes: number; radiologicClinchers?: number }
> = {
  interesting_case: {
    findings: 2000,
    notes: 10000,
  },
  rare_pathology: {
    findings: 2000,
    notes: 10000,
    radiologicClinchers: 160,
  },
  aunt_minnie: {
    findings: 2000,
    notes: 10000,
  },
};

export const stripHtmlToPlainText = (value: string): string => {
  if (!value) return '';
  if (typeof window === 'undefined') {
    return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

export const getCaseTextFieldLength = (
  field: 'findings' | 'notes' | 'radiologicClinchers',
  value: string
): number => field === 'notes' ? stripHtmlToPlainText(value).length : value.length;
