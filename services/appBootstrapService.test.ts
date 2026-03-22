import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchRecentActivity,
  preloadArticleLibraryLanding,
  preloadCalendarData,
  fetchDashboardSnapshot,
  preloadNewsfeedData,
  preloadProfileHome,
  preloadPublishedCases,
  preloadMajorRouteChunks,
  preloadNonCriticalRouteChunks,
} = vi.hoisted(() => ({
  fetchRecentActivity: vi.fn(async () => []),
  preloadArticleLibraryLanding: vi.fn(async () => undefined),
  preloadCalendarData: vi.fn(async () => undefined),
  fetchDashboardSnapshot: vi.fn(async () => undefined),
  preloadNewsfeedData: vi.fn(async () => undefined),
  preloadProfileHome: vi.fn(async () => undefined),
  preloadPublishedCases: vi.fn(async () => undefined),
  preloadMajorRouteChunks: vi.fn(async () => undefined),
  preloadNonCriticalRouteChunks: vi.fn(async () => undefined),
}));

vi.mock('./activityService', () => ({
  fetchRecentActivity,
}));

vi.mock('./articleLibraryService', () => ({
  preloadArticleLibraryLanding,
}));

vi.mock('./CalendarService', () => ({
  CalendarService: {
    preloadCalendarData,
  },
}));

vi.mock('./dashboardSnapshotService', () => ({
  fetchDashboardSnapshot,
}));

vi.mock('./newsfeedService', () => ({
  preloadNewsfeedData,
}));

vi.mock('./profileHomeService', () => ({
  preloadProfileHome,
}));

vi.mock('./publishedCasesService', () => ({
  preloadPublishedCases,
}));

vi.mock('./routePreloadService', () => ({
  preloadMajorRouteChunks,
  preloadNonCriticalRouteChunks,
}));

import { __testables, startAppBootstrap } from './appBootstrapService';

const buildSession = (userId = 'user-1') => ({
  user: { id: userId },
}) as any;

describe('appBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes major route chunk preload as a blocking task', () => {
    const tasks = __testables.getBootstrapTasks(buildSession(), false, 'seed-a');
    const routeTask = tasks.find((task) => task.name === 'route-chunks');

    expect(routeTask).toMatchObject({
      blocking: true,
      weight: 26,
      group: 'route-chunks',
    });
  });

  it('guest mode excludes user-only blocking tasks', () => {
    const tasks = __testables.getBootstrapTasks(null, true, 'seed-a');
    const names = tasks.filter((task) => task.blocking).map((task) => task.name);

    expect(names).toEqual([
      'route-chunks',
      'search-data',
      'article-library-data',
    ]);
  });

  it('does not release before all blocking tasks settle and reaches 100 afterwards', async () => {
    let resolveSearch!: () => void;
    preloadPublishedCases.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSearch = resolve; })
    );

    const snapshots: Array<{ progressPct: number; releaseReady: boolean }> = [];
    const bootstrapPromise = startAppBootstrap({
      session: buildSession(),
      guestMode: false,
      onProgress: (snapshot) => {
        snapshots.push({ progressPct: snapshot.progressPct, releaseReady: snapshot.releaseReady });
      },
    });

    await Promise.resolve();
    expect(snapshots.some((snapshot) => snapshot.releaseReady)).toBe(false);

    resolveSearch();
    const result = await bootstrapPromise;
    const releaseSnapshot = snapshots.find((snapshot) => snapshot.releaseReady);

    expect(result.releaseReason).toBe('blocking-settled');
    expect(releaseSnapshot).toMatchObject({ progressPct: 100, releaseReady: true });
  });

  it('failed blocking tasks still count as settled', async () => {
    preloadProfileHome.mockRejectedValueOnce(new Error('profile preload failed'));

    const snapshots: Array<{ progressPct: number; statusLabel: string; releaseReady: boolean }> = [];
    const result = await startAppBootstrap({
      session: buildSession(),
      guestMode: false,
      onProgress: (snapshot) => {
        snapshots.push({
          progressPct: snapshot.progressPct,
          statusLabel: snapshot.statusLabel,
          releaseReady: snapshot.releaseReady,
        });
      },
    });
    const releaseSnapshot = snapshots.find((snapshot) => snapshot.releaseReady);

    expect(result.tasks.find((task) => task.name === 'profile-data')?.status).toBe('failed');
    expect(releaseSnapshot).toMatchObject({ progressPct: 100, releaseReady: true });
  });

  it('emits phase labels and fun messages in progress snapshots', async () => {
    const snapshots: Array<{ phaseLabel: string; funMessage: string; funMessageKey: string; totalTaskCount: number }> = [];

    await startAppBootstrap({
      session: buildSession(),
      guestMode: false,
      onProgress: (snapshot) => {
        snapshots.push({
          phaseLabel: snapshot.phaseLabel,
          funMessage: snapshot.funMessage,
          funMessageKey: snapshot.funMessageKey,
          totalTaskCount: snapshot.totalTaskCount,
        });
      },
    });

    expect(snapshots.some((snapshot) => snapshot.phaseLabel.length > 0)).toBe(true);
    expect(snapshots.some((snapshot) => snapshot.funMessage.length > 0)).toBe(true);
    expect(snapshots.some((snapshot) => snapshot.funMessageKey.length > 0)).toBe(true);
    expect(snapshots.at(-1)?.totalTaskCount).toBeGreaterThan(0);
  });

  it('uses a stable fun message selection per task', () => {
    const task = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').find((entry) => entry.name === 'calendar-data');

    expect(__testables.stableMessageForTask(task, 'seed-a')).toEqual(__testables.stableMessageForTask(task, 'seed-a'));
  });

  it('uses resident names in generated preload copy', () => {
    const task = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').find((entry) => entry.name === 'dashboard-snapshot');
    const residentRegex = new RegExp(__testables.RESIDENT_BOOT_NAMES.join('|'));

    expect(task?.messagePool.some((message) => residentRegex.test(message))).toBe(true);
  });

  it('builds deterministic resident fun messages with occasional pairs', () => {
    const messages = __testables.buildResidentFunMessage('calendar-data', [
      'convincing the calendar that overnight call was character building.',
    ]);

    expect(messages[0]?.text).toBe(__testables.buildResidentFunMessage('calendar-data', [
      'convincing the calendar that overnight call was character building.',
    ])[0]?.text);
    expect(messages[0]?.text.length).toBeGreaterThan(0);
  });

  it('varies resident preload copy across boot sessions', () => {
    const taskA = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').find((entry) => entry.name === 'search-data');
    const taskB = __testables.getBootstrapTasks(buildSession(), false, 'seed-b').find((entry) => entry.name === 'search-data');

    expect(__testables.stableMessageForTask(taskA, 'seed-a').text).not.toBe(__testables.stableMessageForTask(taskB, 'seed-b').text);
  });
});
