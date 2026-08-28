const PERFORMANCE_PREFIX = 'radcore';

const canMeasurePerformance = () =>
  typeof performance !== 'undefined'
  && typeof performance.now === 'function'
  && typeof performance.measure === 'function';

export const startPerformanceTiming = (): number =>
  canMeasurePerformance() ? performance.now() : Date.now();

export const finishPerformanceTiming = (name: string, startedAt: number): number => {
  const endedAt = canMeasurePerformance() ? performance.now() : Date.now();
  const duration = Math.max(0, endedAt - startedAt);

  if (canMeasurePerformance()) {
    try {
      performance.measure(`${PERFORMANCE_PREFIX}:${name}`, {
        start: startedAt,
        end: endedAt,
        detail: { durationMs: Math.round(duration) },
      });
    } catch {
      // Performance measurements are diagnostic only and must never block the app.
    }
  }

  return duration;
};
