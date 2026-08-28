import { describe, expect, it } from 'vitest';
import { sanitizeLogValue } from './safeLogger';

describe('safeLogger', () => {
  it('redacts identifiers, contact details, and URLs', () => {
    const sanitized = sanitizeLogValue('Patient 123456789 email dr@example.com file https://host/image and 123e4567-e89b-12d3-a456-426614174000');
    expect(sanitized).toBe('Patient [ID] email [EMAIL] file [URL] and [ID]');
  });

  it('drops arbitrary object fields while preserving operational error fields', () => {
    expect(sanitizeLogValue({ code: 'PGRST202', status: 400, notes: 'clinical notes', patientId: '12345678' })).toEqual({
      code: 'PGRST202',
      status: 400,
    });
  });
});
