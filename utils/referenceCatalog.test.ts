import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BOOK_TITLES,
  REFERENCE_SOURCE_TYPES,
  STANDARD_REFERENCE_SOURCE_TYPE,
  getReferenceEntryField,
  isCatalogReferenceBook,
  normalizeReferenceSourceType,
} from './referenceCatalog';

describe('reference catalogue', () => {
  it('contains the 11 approved mother books with editions and years', () => {
    expect(REFERENCE_BOOK_TITLES).toHaveLength(11);
    expect(new Set(REFERENCE_BOOK_TITLES).size).toBe(11);
    REFERENCE_BOOK_TITLES.forEach((title) => {
      expect(title).toMatch(/\d+(?:st|nd|rd|th) ed\. \(\d{4}\)$/);
    });
  });

  it('does not include PI-RADS', () => {
    expect(REFERENCE_BOOK_TITLES.join(' ')).not.toMatch(/PI-RADS/i);
  });

  it('offers books and non-book reference paths', () => {
    expect(REFERENCE_SOURCE_TYPES).toEqual([
      STANDARD_REFERENCE_SOURCE_TYPE,
      'Journal / DOI',
      'Web Link',
      'Guideline / Consensus',
      'Lecture / Handout',
      'Other',
    ]);
    expect(getReferenceEntryField('Web Link')).toMatchObject({ inputType: 'url', label: 'Web link' });
  });

  it('normalizes legacy source labels without losing custom titles', () => {
    expect(normalizeReferenceSourceType('Book')).toBe(STANDARD_REFERENCE_SOURCE_TYPE);
    expect(normalizeReferenceSourceType('Journal Article')).toBe('Journal / DOI');
    expect(normalizeReferenceSourceType('Online Resource')).toBe('Web Link');
    expect(isCatalogReferenceBook('Unlisted legacy book')).toBe(false);
  });
});
