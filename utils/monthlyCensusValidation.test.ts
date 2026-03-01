import { describe, expect, it } from 'vitest';
import {
  getMonthlyCensusErrorMessage,
  isValidMonthlyCensusRotation,
  parseNonNegativeInt,
  parseNonNegativeScore,
} from './monthlyCensusValidation';

describe('monthlyCensusValidation', () => {
  it('parses non-negative integers', () => {
    expect(parseNonNegativeInt('0')).toBe(0);
    expect(parseNonNegativeInt('12')).toBe(12);
    expect(parseNonNegativeInt(' 8 ')).toBe(8);
    expect(parseNonNegativeInt('-1')).toBeNull();
    expect(parseNonNegativeInt('1.5')).toBeNull();
    expect(parseNonNegativeInt('abc')).toBeNull();
  });

  it('parses non-negative score with up to 2 decimals', () => {
    expect(parseNonNegativeScore('0')).toBe(0);
    expect(parseNonNegativeScore('89.5')).toBe(89.5);
    expect(parseNonNegativeScore('91.257')).toBeNull();
    expect(parseNonNegativeScore('-2')).toBeNull();
    expect(parseNonNegativeScore('abc')).toBeNull();
  });

  it('maps missing table error code to migration guidance', () => {
    expect(getMonthlyCensusErrorMessage({ code: '42P01', message: 'relation missing' }, 'fallback')).toContain('Run the latest migration');
    expect(getMonthlyCensusErrorMessage({ message: 'plain error' }, 'fallback')).toBe('plain error');
    expect(getMonthlyCensusErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('validates monthly census rotation values', () => {
    expect(isValidMonthlyCensusRotation('General Radiology')).toBe(true);
    expect(isValidMonthlyCensusRotation('Pedia/MSK')).toBe(true);
    expect(isValidMonthlyCensusRotation('Invalid Rotation')).toBe(false);
  });
});
