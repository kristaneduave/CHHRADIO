import { describe, expect, it } from 'vitest';
import { buildCalendarSearchOrClause } from './CalendarService';

describe('CalendarService search clause', () => {
  it('builds text-only OR clause when no user ids are present', () => {
    const clause = buildCalendarSearchOrClause('mri', []);
    expect(clause).toContain('title.ilike.%mri%');
    expect(clause).toContain('description.ilike.%mri%');
    expect(clause).not.toContain('assigned_to.in.');
  });

  it('adds safe UUID user conditions when IDs are valid', () => {
    const clause = buildCalendarSearchOrClause('lecture', [
      '11111111-1111-4111-8111-111111111111',
      'bad-value',
      '22222222-2222-4222-8222-222222222222',
    ]);

    expect(clause).toContain('assigned_to.in.(11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222)');
    expect(clause).toContain('created_by.in.(11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222)');
    expect(clause).not.toContain('bad-value');
  });
});
