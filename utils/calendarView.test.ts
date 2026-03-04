import { describe, expect, it } from 'vitest';
import {
  buildEventDateTimeRange,
  formatWeekRange,
  fromLocalDateInput,
  getWeekDays,
  getWeekStart,
  isSameDay,
  isSameWeek,
  toLocalDateInputValue,
} from './calendarView';

const toLocalYmd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('calendarView utilities', () => {
  it('computes monday-start week start correctly', () => {
    const date = new Date('2026-03-01T10:30:00'); // Sunday
    const start = getWeekStart(date, true);
    expect(toLocalYmd(start)).toBe('2026-02-23');
  });

  it('returns seven sequential week days', () => {
    const days = getWeekDays(new Date('2026-03-03T09:00:00'), true);
    expect(days).toHaveLength(7);
    expect(toLocalYmd(days[0])).toBe('2026-03-02');
    expect(toLocalYmd(days[6])).toBe('2026-03-08');
  });

  it('formats week range across months and years', () => {
    expect(formatWeekRange(new Date('2026-03-02'), new Date('2026-03-08'))).toBe('Mar 2 - 8');
    expect(formatWeekRange(new Date('2026-02-24'), new Date('2026-03-02'))).toBe('Feb 24 - Mar 2');
    expect(formatWeekRange(new Date('2026-12-29'), new Date('2027-01-04'))).toBe('Dec 29, 2026 - Jan 4, 2027');
  });

  it('detects same day and same week around midnight boundaries', () => {
    const a = new Date('2026-03-02T00:01:00');
    const b = new Date('2026-03-02T23:59:00');
    const c = new Date('2026-03-08T23:59:00');
    const d = new Date('2026-03-09T00:01:00');
    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, c)).toBe(false);
    expect(isSameWeek(a, c, true)).toBe(true);
    expect(isSameWeek(a, d, true)).toBe(false);
  });

  it('round-trips local date input values without timezone shift', () => {
    const value = '2026-03-03';
    const parsed = fromLocalDateInput(value);
    expect(toLocalDateInputValue(parsed)).toBe(value);
  });

  it('builds all-day local range correctly', () => {
    const range = buildEventDateTimeRange({
      startDate: '2026-03-03',
      endDate: '2026-03-05',
      startTime: '08:00',
      endTime: '17:00',
      isAllDay: true,
    });
    expect(toLocalYmd(range.start)).toBe('2026-03-03');
    expect(toLocalYmd(range.end)).toBe('2026-03-05');
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getHours()).toBe(23);
  });

  it('builds timed range across days and rejects invalid date input', () => {
    const range = buildEventDateTimeRange({
      startDate: '2026-03-03',
      endDate: '2026-03-04',
      startTime: '21:00',
      endTime: '02:00',
      isAllDay: false,
    });
    expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());
    expect(() => fromLocalDateInput('bad')).toThrow();
  });
});
