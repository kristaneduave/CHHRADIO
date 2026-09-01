import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  fetchRecentActivity,
  fetchDashboardSnapshot,
  preloadNewsfeedData,
  preloadProfileHome,
  preloadPublishedCases,
  preloadLiveAuntMinnieWorkspace,
  preloadCalendarWorkspace,
  preloadTopRouteChunks,
} = vi.hoisted(() => ({
  fetchRecentActivity: vi.fn(async () => []),
  fetchDashboardSnapshot: vi.fn(async () => undefined),
  preloadNewsfeedData: vi.fn(async () => undefined),
  preloadProfileHome: vi.fn(async () => undefined),
  preloadPublishedCases: vi.fn(async () => undefined),
  preloadLiveAuntMinnieWorkspace: vi.fn(async () => undefined),
  preloadCalendarWorkspace: vi.fn(async () => undefined),
  preloadTopRouteChunks: vi.fn(async () => undefined),
}));

vi.mock('./activityService', () => ({
  fetchRecentActivity,
}));

vi.mock('./calendarWorkspaceService', () => ({
  preloadCalendarWorkspace,
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

vi.mock('./liveAuntMinnieService', () => ({
  preloadLiveAuntMinnieWorkspace,
}));

vi.mock('./routePreloadService', () => ({
  preloadTopRouteChunks,
}));

import { __testables, startAppBootstrap } from './appBootstrapService';

const buildSession = (userId = 'user-1') => ({
  user: { id: userId },
}) as any;

describe('appBootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __testables.resetBootMessageSelectionCache();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  it('warms common route chunks without delaying first render', () => {
    const tasks = __testables.getBootstrapTasks(buildSession(), false, 'seed-a');
    const routeTask = tasks.find((task) => task.name === 'route-chunks');

    expect(routeTask).toMatchObject({
      blocking: false,
      weight: 0,
      group: 'route-chunks',
    });
  });

  it('guest mode opens immediately while public data warms in the background', () => {
    const tasks = __testables.getBootstrapTasks(null, true, 'seed-a');
    const names = tasks.filter((task) => task.blocking).map((task) => task.name);

    expect(names).toEqual([]);
  });

  it('does not preload disabled Articles or Anatomy features during startup', () => {
    const taskNames = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').map((task) => task.name);

    expect(taskNames).not.toContain('article-library-data');
    expect(taskNames).not.toContain('anatomy-route-chunk');
  });

  it('does not release before all blocking tasks settle and reaches 100 afterwards', async () => {
    let resolveDashboard!: () => void;
    fetchDashboardSnapshot.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveDashboard = resolve; })
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

    resolveDashboard();
    const result = await bootstrapPromise;
    const releaseSnapshot = snapshots.find((snapshot) => snapshot.releaseReady);

    expect(result.releaseReason).toBe('blocking-settled');
    expect(releaseSnapshot).toMatchObject({ progressPct: 100, releaseReady: true });
  });

  it('failed blocking tasks still count as settled', async () => {
    fetchDashboardSnapshot.mockRejectedValueOnce(new Error('dashboard preload failed'));

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

    expect(result.tasks.find((task) => task.name === 'dashboard-snapshot')?.status).toBe('failed');
    expect(releaseSnapshot).toMatchObject({ progressPct: 100, releaseReady: true });
  });

  it('releases the app when dashboard loading exceeds the startup timeout', async () => {
    fetchDashboardSnapshot.mockImplementationOnce(() => new Promise<void>(() => undefined));

    const result = await startAppBootstrap({
      session: buildSession(),
      guestMode: false,
      timeoutMs: 5,
    });

    expect(result.releaseReason).toBe('timeout');
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
    const groupRegex = new RegExp(__testables.RESIDENT_BOOT_GROUPS.join('|'));

    expect(task?.messagePool.some((message) => residentRegex.test(message))).toBe(true);
    expect(task?.messagePool.some((message) => groupRegex.test(message))).toBe(true);
  });

  it('builds deterministic resident fun messages across single, pair, trio, and group leads', () => {
    const messages = __testables.buildResidentFunMessage('calendar-data', [
      'convincing the calendar that overnight call was character building.',
    ]);

    expect(messages[0]?.text).toBe(__testables.buildResidentFunMessage('calendar-data', [
      'convincing the calendar that overnight call was character building.',
    ])[0]?.text);
    expect(messages[0]?.text.length).toBeGreaterThan(0);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.some((message) => /\bis\b/.test(message.text))).toBe(true);
    expect(messages.some((message) => /\band\b/.test(message.text))).toBe(true);
    expect(messages.some((message) => /, .*?, and /.test(message.text))).toBe(true);
    expect(messages.some((message) => new RegExp(__testables.RESIDENT_BOOT_GROUPS.join('|')).test(message.text))).toBe(true);
  });

  it('varies resident preload copy across boot sessions', () => {
    const taskA = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').find((entry) => entry.name === 'search-data');
    const taskB = __testables.getBootstrapTasks(buildSession(), false, 'seed-b').find((entry) => entry.name === 'search-data');

    expect(__testables.stableMessageForTask(taskA, 'seed-a').text).not.toBe(__testables.stableMessageForTask(taskB, 'seed-b').text);
  });

  it('avoids recently used boot messages across successive runs when alternatives exist', () => {
    const taskA = __testables.getBootstrapTasks(buildSession(), false, 'seed-a').find((entry) => entry.name === 'dashboard-snapshot');
    const taskB = __testables.getBootstrapTasks(buildSession(), false, 'seed-b').find((entry) => entry.name === 'dashboard-snapshot');

    const first = __testables.stableMessageForTask(taskA, 'seed-a');
    const second = __testables.stableMessageForTask(taskB, 'seed-b');

    expect(first.text).not.toBe(second.text);
  });
});
