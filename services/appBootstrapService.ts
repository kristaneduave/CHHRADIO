import { Session } from '@supabase/supabase-js';
import { fetchRecentActivity } from './activityService';
import { preloadArticleLibraryLanding } from './articleLibraryService';
import { CalendarService } from './CalendarService';
import { fetchDashboardSnapshot } from './dashboardSnapshotService';
import { preloadNewsfeedData } from './newsfeedService';
import { preloadProfileHome } from './profileHomeService';
import { preloadPublishedCases } from './publishedCasesService';
import { preloadMajorRouteChunks, preloadNonCriticalRouteChunks } from './routePreloadService';

export type AppBootstrapTaskName =
  | 'dashboard-snapshot'
  | 'unread-count-and-newsfeed'
  | 'route-chunks'
  | 'calendar-data'
  | 'search-data'
  | 'profile-data'
  | 'article-library-data'
  | 'activity-data'
  | 'anatomy-route-chunk';

type TaskStatus = 'pending' | 'running' | 'done' | 'failed';
type AppBootstrapTaskGroup = 'core-shell' | 'route-chunks' | 'dashboard-data' | 'major-screen-data' | 'post-release';

export interface AppBootstrapProgressSnapshot {
  progressPct: number;
  statusLabel: string;
  releaseReady: boolean;
  phaseLabel: string;
  completedTaskCount: number;
  totalTaskCount: number;
  currentTaskName?: AppBootstrapTaskName;
  funMessage: string;
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
  group: AppBootstrapTaskGroup;
  messagePool: string[];
  run: () => Promise<void>;
}

export interface AppBootstrapResult {
  releaseReason: 'blocking-settled';
  tasks: AppBootstrapTaskResult[];
  backgroundPromise: Promise<void>;
}

const GROUP_PHASE_LABELS: Record<AppBootstrapTaskGroup, string> = {
  'core-shell': 'Preparing workspace shell',
  'route-chunks': 'Warming major screens',
  'dashboard-data': 'Collecting dashboard essentials',
  'major-screen-data': 'Preloading major screen data',
  'post-release': 'Finishing optional warmups',
};

const FALLBACK_FUN_MESSAGES = [
  'Checking if the residents broke the dashboard again...',
  'Warming up the PACS-adjacent vibes...',
  'Making the homepage look suspiciously prepared...',
];

const stableMessageForTask = (task?: AppBootstrapTask | null) => {
  if (!task || task.messagePool.length === 0) {
    return FALLBACK_FUN_MESSAGES[0];
  }

  const hash = Array.from(task.name).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return task.messagePool[hash % task.messagePool.length];
};

const getBootstrapTasks = (session: Session | null, guestMode: boolean): AppBootstrapTask[] => {
  const userId = session?.user?.id || '';
  const hasUser = Boolean(userId) && !guestMode;

  const blockingTasks: AppBootstrapTask[] = [
    {
      name: 'route-chunks',
      label: 'Warming major screens',
      weight: 26,
      blocking: true,
      group: 'route-chunks',
      messagePool: [
        'Hanging the films very, very digitally...',
        'Making the homepage look suspiciously prepared...',
        'Stocking the reading room with screen chunks...',
      ],
      run: async () => {
        await preloadMajorRouteChunks();
      },
    },
    {
      name: 'search-data',
      label: 'Indexing published cases',
      weight: 14,
      blocking: true,
      group: 'major-screen-data',
      messagePool: [
        'Indexing interesting cases before anyone asks for them...',
        'Counting cases like it is conference tomorrow...',
        'Alphabetizing diagnostic chaos...',
      ],
      run: async () => {
        await preloadPublishedCases();
      },
    },
    {
      name: 'article-library-data',
      label: 'Preparing Article Library',
      weight: 8,
      blocking: true,
      group: 'major-screen-data',
      messagePool: [
        'Dusting off the pathology shelf...',
        'Teaching the library to look awake...',
        'Telling the guidelines to line up neatly...',
      ],
      run: async () => {
        await preloadArticleLibraryLanding();
      },
    },
    ...(!hasUser
      ? []
      : ([
          {
            name: 'dashboard-snapshot',
            label: 'Preparing dashboard',
            weight: 16,
            blocking: true,
            group: 'dashboard-data',
            messagePool: [
              'Checking if the residents broke the dashboard again...',
              'Adjusting the window level of reality...',
              'Laying out the dashboard like rounds start in five minutes...',
            ],
            run: async () => {
              await fetchDashboardSnapshot();
            },
          },
          {
            name: 'unread-count-and-newsfeed',
            label: 'Preparing newsfeed',
            weight: 10,
            blocking: true,
            group: 'major-screen-data',
            messagePool: [
              'Scanning the newsfeed for fresh chaos...',
              'Checking if anyone posted another urgent reminder...',
              'Warming the feed before the gossip cools...',
            ],
            run: async () => {
              await preloadNewsfeedData(userId);
            },
          },
          {
            name: 'profile-data',
            label: 'Preparing profile workspace',
            weight: 10,
            blocking: true,
            group: 'major-screen-data',
            messagePool: [
              'Straightening your profile workspace...',
              'Polishing the profile before anyone judges it...',
              'Making your profile look clinically organized...',
            ],
            run: async () => {
              await preloadProfileHome(userId);
            },
          },
          {
            name: 'calendar-data',
            label: 'Preparing calendar',
            weight: 8,
            blocking: true,
            group: 'major-screen-data',
            messagePool: [
              'Convincing the calendar to cooperate...',
              'Reassuring the schedule that call still exists...',
              'Arranging time as if radiology were predictable...',
            ],
            run: async () => {
              await CalendarService.preloadCalendarData(new Date(), 10);
            },
          },
          {
            name: 'activity-data',
            label: 'Preparing recent activity',
            weight: 4,
            blocking: true,
            group: 'major-screen-data',
            messagePool: [
              'Replaying recent activity at diagnostic speed...',
              'Checking who did something noteworthy...',
              'Summoning the latest breadcrumbs of activity...',
            ],
            run: async () => {
              await fetchRecentActivity(userId, 20);
            },
          },
        ] as AppBootstrapTask[])),
  ];

  const backgroundTasks: AppBootstrapTask[] = [
    {
      name: 'anatomy-route-chunk',
      label: 'Warming Anatomy screen',
      weight: 0,
      blocking: false,
      group: 'post-release',
      messagePool: [
        'Quietly wheeling anatomy into the reading room...',
      ],
      run: async () => {
        await preloadNonCriticalRouteChunks();
      },
    },
  ];

  return [...blockingTasks, ...backgroundTasks];
};

const buildProgressSnapshot = (
  tasks: AppBootstrapTask[],
  results: Map<AppBootstrapTaskName, AppBootstrapTaskResult>,
  releaseReady: boolean,
): AppBootstrapProgressSnapshot => {
  const blockingTasks = tasks.filter((task) => task.blocking);
  const totalBlockingWeight = blockingTasks.reduce((sum, task) => sum + task.weight, 0) || 1;
  const settledStatuses: TaskStatus[] = ['done', 'failed'];
  const completedTaskCount = blockingTasks.filter((task) => settledStatuses.includes(results.get(task.name)?.status || 'pending')).length;
  const settledWeight = blockingTasks.reduce((sum, task) => {
    const status = results.get(task.name)?.status;
    return settledStatuses.includes(status || 'pending') ? sum + task.weight : sum;
  }, 0);
  const progressPct = releaseReady ? 100 : Math.max(0, Math.min(99, Math.round((settledWeight / totalBlockingWeight) * 100)));
  const activeTask =
    blockingTasks.find((task) => results.get(task.name)?.status === 'running')
    || blockingTasks.find((task) => !results.has(task.name) || results.get(task.name)?.status === 'pending')
    || null;
  const failedBlockingTask = blockingTasks.find((task) => results.get(task.name)?.status === 'failed') || null;
  const phaseLabel = releaseReady
    ? 'Opening workspace'
    : activeTask
      ? GROUP_PHASE_LABELS[activeTask.group]
      : 'Preparing workspace';
  const statusLabel = releaseReady
    ? 'Opening workspace'
    : failedBlockingTask && completedTaskCount < blockingTasks.length
      ? 'Still opening workspace — one dataset had trouble warming'
      : activeTask?.label || 'Preparing workspace';

  return {
    progressPct,
    statusLabel,
    releaseReady,
    phaseLabel,
    completedTaskCount,
    totalTaskCount: blockingTasks.length,
    currentTaskName: activeTask?.name,
    funMessage: stableMessageForTask(activeTask),
  };
};

export const startAppBootstrap = async (options: {
  session: Session | null;
  guestMode: boolean;
  timeoutMs?: number;
  onProgress?: (snapshot: AppBootstrapProgressSnapshot) => void;
}): Promise<AppBootstrapResult> => {
  const tasks = getBootstrapTasks(options.session, options.guestMode);
  const blockingTasks = tasks.filter((task) => task.blocking);
  const backgroundTasks = tasks.filter((task) => !task.blocking);
  const results = new Map<AppBootstrapTaskName, AppBootstrapTaskResult>();

  const emitProgress = (releaseReady = false) => {
    options.onProgress?.(buildProgressSnapshot(tasks, results, releaseReady));
  };

  emitProgress(false);

  const runTask = async (task: AppBootstrapTask) => {
    results.set(task.name, {
      name: task.name,
      blocking: task.blocking,
      status: 'running',
      weight: task.weight,
    });
    emitProgress(false);

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
      emitProgress(false);
    }
  };

  await Promise.allSettled(blockingTasks.map((task) => runTask(task)));
  emitProgress(true);

  const backgroundPromise = Promise.allSettled(backgroundTasks.map((task) => runTask(task))).then(() => undefined);

  return {
    releaseReason: 'blocking-settled',
    tasks: Array.from(results.values()),
    backgroundPromise,
  };
};

export const __testables = {
  buildProgressSnapshot,
  getBootstrapTasks,
  stableMessageForTask,
};
