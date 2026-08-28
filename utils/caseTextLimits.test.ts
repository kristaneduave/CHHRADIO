import { describe, expect, it } from 'vitest';
import { CASE_TEXT_LIMITS, getCaseTextFieldLength, stripHtmlToPlainText } from './caseTextLimits';

describe('case text limits', () => {
  it.each(['interesting_case', 'rare_pathology', 'aunt_minnie'] as const)(
    'allows 2,000-character findings and 10,000-character notes for %s',
    (submissionType) => {
      expect(CASE_TEXT_LIMITS[submissionType].findings).toBe(2000);
      expect(CASE_TEXT_LIMITS[submissionType].notes).toBe(10000);
    }
  );

  it('keeps the Rare Pathology radiologic clinchers limit unchanged', () => {
    expect(CASE_TEXT_LIMITS.rare_pathology.radiologicClinchers).toBe(160);
    expect(CASE_TEXT_LIMITS.interesting_case.radiologicClinchers).toBeUndefined();
    expect(CASE_TEXT_LIMITS.aunt_minnie.radiologicClinchers).toBeUndefined();
  });

  it('counts spaces in findings and descriptions', () => {
    expect(getCaseTextFieldLength('findings', 'two words')).toBe(9);
  });

  it('counts only normalized plain text for rich-text notes', () => {
    const notes = '<p><strong>Two</strong> words next line</p>';

    expect(stripHtmlToPlainText(notes)).toBe('Two words next line');
    expect(getCaseTextFieldLength('notes', notes)).toBe(19);
  });
});
