type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type FetchWithCacheOptions = {
  ttlMs?: number;
  allowStaleWhileRevalidate?: boolean;
  maxInFlightMs?: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
type InFlightEntry = {
  promise: Promise<unknown>;
  startedAt: number;
};

const inFlightStore = new Map<string, InFlightEntry>();

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_INFLIGHT_MS = 15_000;

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';
};

const isInFlightEntry = (value: unknown): value is InFlightEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<InFlightEntry>;
  return isPromiseLike(entry.promise) && typeof entry.startedAt === 'number' && Number.isFinite(entry.startedAt);
};

export const fetchWithCache = async <T>(
  key: string,
  fetcher: () => T | PromiseLike<T>,
  options?: FetchWithCacheOptions,
): Promise<T> => {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const allowStale = options?.allowStaleWhileRevalidate !== false;
  const maxInFlightMs = options?.maxInFlightMs ?? DEFAULT_MAX_INFLIGHT_MS;
  const now = Date.now();
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const rawInFlight = inFlightStore.get(key) as unknown;
  if (rawInFlight && !isInFlightEntry(rawInFlight)) {
    inFlightStore.delete(key);
  }

  const existingInFlight = inFlightStore.get(key) as InFlightEntry | undefined;
  if (existingInFlight && now - existingInFlight.startedAt > maxInFlightMs) {
    inFlightStore.delete(key);
  }

  const activeInFlight = inFlightStore.get(key) as InFlightEntry | undefined;
  if (activeInFlight) {
    if (cached && allowStale) return cached.value;
    return activeInFlight.promise as Promise<T>;
  }

  const request = Promise.resolve(fetcher())
    .then((value) => {
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, ttlMs),
      });
      return value;
    })
    .finally(() => {
      const current = inFlightStore.get(key);
      if (current?.promise === request) {
        inFlightStore.delete(key);
      }
    });

  inFlightStore.set(key, {
    promise: request,
    startedAt: now,
  });

  if (cached && allowStale) {
    void request.catch(() => {
      // Keep stale cache if background refresh fails.
    });
    return cached.value;
  }

  return request;
};

export const invalidateCacheKey = (key: string): void => {
  cacheStore.delete(key);
  inFlightStore.delete(key);
};

export const invalidateCacheByPrefix = (prefix: string): void => {
  Array.from(cacheStore.keys()).forEach((key) => {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  });
  Array.from(inFlightStore.keys()).forEach((key) => {
    if (key.startsWith(prefix)) inFlightStore.delete(key);
  });
};
