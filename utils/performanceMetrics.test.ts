import { describe, expect, it, vi } from 'vitest';
import { finishPerformanceTiming, startPerformanceTiming } from './performanceMetrics';

describe('performanceMetrics', () => {
  it('records a non-sensitive named duration', () => {
    const measureSpy = vi.spyOn(performance, 'measure');
    const startedAt = startPerformanceTiming();

    const duration = finishPerformanceTiming('database.load', startedAt);

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(measureSpy).toHaveBeenCalledWith(
      'radcore:database.load',
      expect.objectContaining({ start: startedAt }),
    );
  });
});
