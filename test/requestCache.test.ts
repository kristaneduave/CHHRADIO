import { describe, expect, it, vi } from 'vitest';
import { fetchWithCache, invalidateCacheByPrefix, invalidateCacheKey } from '../utils/requestCache';

describe('requestCache', () => {
  it('dedupes in-flight requests by key', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true };
    });

    const [a, b] = await Promise.all([
      fetchWithCache('k:inflight', fetcher),
      fetchWithCache('k:inflight', fetcher),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(calls).toBe(1);
  });

  it('serves cached value within ttl', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      return calls;
    });

    const first = await fetchWithCache('k:ttl', fetcher, { ttlMs: 1_000 });
    const second = await fetchWithCache('k:ttl', fetcher, { ttlMs: 1_000 });

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(calls).toBe(1);

    invalidateCacheKey('k:ttl');
  });

  it('invalidates keys by prefix', async () => {
    await fetchWithCache('pref:a', async () => 1, { ttlMs: 5_000 });
    await fetchWithCache('pref:b', async () => 2, { ttlMs: 5_000 });
    invalidateCacheByPrefix('pref:');

    let calls = 0;
    const value = await fetchWithCache('pref:a', async () => {
      calls += 1;
      return 3;
    });

    expect(value).toBe(3);
    expect(calls).toBe(1);
  });

  it('replaces stale in-flight requests after maxInFlightMs', async () => {
    let resolveFirst: ((value: number) => void) | null = null;
    const firstFetcher = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const firstPromise = fetchWithCache('k:stale-inflight', firstFetcher, {
      maxInFlightMs: 10,
      allowStaleWhileRevalidate: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    const secondFetcher = vi.fn(async () => 2);
    const secondResult = await fetchWithCache('k:stale-inflight', secondFetcher, {
      maxInFlightMs: 10,
      allowStaleWhileRevalidate: false,
    });

    expect(secondResult).toBe(2);
    expect(firstFetcher).toHaveBeenCalledTimes(1);
    expect(secondFetcher).toHaveBeenCalledTimes(1);

    resolveFirst?.(1);
    await firstPromise;
    invalidateCacheKey('k:stale-inflight');
  });
});
