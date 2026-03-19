import { Session } from '@supabase/supabase-js';
import { fetchRecentActivity } from './activityService';
import { preloadArticleLibraryLanding } from './articleLibraryService';
import { CalendarService } from './CalendarService';
import { fetchDashboardSnapshot } from './dashboardSnapshotService';
import { preloadNewsfeedData } from './newsfeedService';
import { preloadProfileHome } from './profileHomeService';
import { preloadPublishedCases } from './publishedCasesService';
import { preloadTopRouteChunks } from './routePreloadService';

export type AppBootstrapTaskName =
  | 'dashboard-snapshot'
  | 'unread-count-and-newsfeed'
  | 'route-chunks'
  | 'calendar-data'
  | 'search-data'
  | 'profile-data'
  | 'article-library-data'
  | 'activity-data';

type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'timed_out';

export interface AppBootstrapProgressSnapshot {
  progressPct: number;
  statusLabel: string;
  releaseReady: boolean;
}

export interface AppBootstrapTaskResult {
  name: AppBootstrapTaskName;
  blocking: boolean;
  status: TaskStatus;
  weight: number;
  error?: string;
}

interface AppBootstrapTask {
  name: AppBootstrapTaskName;
  label: string;
  weight: number;
  blocking: boolean;
  run: () => Promise<void>;
}

export interface AppBootstrapResult {
  releaseReason: 'blocking-complete' | 'timeout';
  tasks: AppBootstrapTaskResult[];
  backgroundPromise: Promise<void>;
}

const getStatusLabel = (progressPct: number): string => {
  if (progressPct < 30) return 'Checking session';
  if (progressPct < 60) return 'Preparing dashboard';
  if (progressPct < 100) return 'Warming top routes';
  return 'Opening workspace';
};

const getBootstrapTasks = (session: Session | null, guestMode: boolean): AppBootstrapTask[] => {
  const userId = session?.user?.id || '';

  const blockingTasks: AppBootstrapTask[] = [
    {
      name: 'dashboard-snapshot',
      label: 'Preparing dashboard',
      weight: 35,
      blocking: true,
      run: async () => {
        if (!userId) return;
        await fetchDashboardSnapshot();
      },
    },
    {
      name: 'unread-count-and-newsfeed',
      label: 'Preparing dashboard',
      weight: guestMode ? 0 : 15,
      blocking: true,
      run: async () => {
        if (!userId) return;
        await preloadNewsfeedData(userId);
      },
    },
  ];

  const backgroundTasks: AppBootstrapTask[] = [
        {
          name: 'route-chunks',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await preloadTopRouteChunks();
          },
        },
        ...(!userId ? [] : ([
        {
          name: 'calendar-data',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await CalendarService.preloadCalendarData(new Date(), 10);
          },
        },
        {
          name: 'search-data',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await preloadPublishedCases();
          },
        },
        {
          name: 'profile-data',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await preloadProfileHome(userId);
          },
        },
        {
          name: 'article-library-data',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await preloadArticleLibraryLanding();
          },
        },
        {
          name: 'activity-data',
          label: 'Warming top routes',
          weight: 0,
          blocking: false,
          run: async () => {
            await fetchRecentActivity(userId, 20);
          },
        },
      ] as AppBootstrapTask[])),
      ];

  return [...blockingTasks, ...backgroundTasks];
};

export const startAppBootstrap = async (options: {
  session: Session | null;
  guestMode: boolean;
  timeoutMs?: number;
  onProgress?: (snapshot: AppBootstrapProgressSnapshot) => void;
}): Promise<AppBootstrapResult> => {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const tasks = getBootstrapTasks(options.session, options.guestMode);
  const blockingTasks = tasks.filter((task) => task.blocking);
  const backgroundTasks = tasks.filter((task) => !task.blocking);
  const results = new Map<AppBootstrapTaskName, AppBootstrapTaskResult>();
  const totalBlockingWeight = blockingTasks.reduce((sum, task) => sum + task.weight, 0) || 1;
  let resolvedBlockingWeight = 0;

  const emitProgress = (releaseReady = false) => {
    const progressPct = Math.max(15, Math.min(100, 15 + Math.round((resolvedBlockingWeight / totalBlockingWeight) * 85)));
    options.onProgress?.({
      progressPct,
      statusLabel: getStatusLabel(progressPct),
      releaseReady,
    });
  };

  emitProgress(false);

  const runTask = async (task: AppBootstrapTask) => {
    results.set(task.name, {
      name: task.name,
      blocking: task.blocking,
      status: 'running',
      weight: task.weight,
    });

    try {
      await task.run();
      results.set(task.name, {
        name: task.name,
        blocking: task.blocking,
        status: 'done',
        weight: task.weight,
      });
    } catch (error: any) {
      console.error(`Bootstrap task failed: ${task.name}`, error);
      results.set(task.name, {
        name: task.name,
        blocking: task.blocking,
        status: 'failed',
        weight: task.weight,
        error: error?.message || String(error),
      });
    } finally {
      if (task.blocking) {
        resolvedBlockingWeight += task.weight;
      }
      emitProgress(false);
    }
  };

  const blockingPromises = blockingTasks.map((task) => runTask(task));

  const releaseReason = await Promise.race<'blocking-complete' | 'timeout'>([
    Promise.allSettled(blockingPromises).then(() => 'blocking-complete'),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
  ]);

  if (releaseReason === 'timeout') {
    blockingTasks.forEach((task) => {
      const current = results.get(task.name);
      if (current?.status === 'running') {
        results.set(task.name, { ...current, status: 'timed_out' });
      }
    });
  }

  options.onProgress?.({
    progressPct: 100,
    statusLabel: 'Opening workspace',
    releaseReady: true,
  });

  const backgroundPromise = Promise.allSettled(backgroundTasks.map((task) => runTask(task))).then(() => undefined);

  return {
    releaseReason,
    tasks: Array.from(results.values()),
    backgroundPromise,
  };
};
