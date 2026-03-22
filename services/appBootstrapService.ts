import { Session } from '@supabase/supabase-js';
import { fetchRecentActivity } from './activityService';
import { preloadArticleLibraryLanding } from './articleLibraryService';
import { CalendarService } from './CalendarService';
import { fetchDashboardSnapshot } from './dashboardSnapshotService';
import { preloadNewsfeedData } from './newsfeedService';
import { preloadProfileHome } from './profileHomeService';
import { preloadPublishedCases } from './publishedCasesService';
import { preloadQuizWorkspace } from './quizService';
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
  | 'quiz-data'
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
  funMessageKey: string;
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

const RESIDENT_BOOT_NAMES = [
  'Tan',
  'Tine',
  'Gene',
  'Pete',
  'Algen',
  'Pao',
  'Kurt',
  'Kuys',
  'Selji',
  'Joh',
  'Dimmy',
  'Adam',
  'Kat',
  'Kit',
  'Von',
  'Franco',
  'Bern',
  'Erikka',
  'France',
  'Lance',
  'Doc Marton',
] as const;

const hashString = (value: string) =>
  Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const buildResidentFunMessage = (seed: string, actions: string[]) => {
  const primaryIndex = hashString(`${seed}:primary`) % RESIDENT_BOOT_NAMES.length;
  const primaryResident = RESIDENT_BOOT_NAMES[primaryIndex];
  const groupMode = hashString(`${seed}:group`) % 5;
  const secondaryOffset = (hashString(`${seed}:secondary`) % (RESIDENT_BOOT_NAMES.length - 1)) + 1;
  const secondaryResident = RESIDENT_BOOT_NAMES[(primaryIndex + secondaryOffset) % RESIDENT_BOOT_NAMES.length];
  const tertiaryOffset = (hashString(`${seed}:tertiary`) % (RESIDENT_BOOT_NAMES.length - 2)) + 2;
  const tertiaryResident = RESIDENT_BOOT_NAMES[(primaryIndex + tertiaryOffset) % RESIDENT_BOOT_NAMES.length];
  const residentLead = groupMode <= 1
    ? `${primaryResident}, ${secondaryResident}, and ${tertiaryResident} are`
    : `${primaryResident} and ${secondaryResident} are`;

  return actions.map((action, index) => ({
    key: `${seed}:${index}:${groupMode <= 1 ? 'trio' : 'pair'}`,
    text: `${residentLead} ${action}`,
  }));
};

const buildTaskMessagePool = (taskName: AppBootstrapTaskName, actions: string[], runSeed: string) =>
  buildResidentFunMessage(`${runSeed}:${taskName}`, actions);

const stableMessageForTask = (task: AppBootstrapTask | null | undefined, runSeed: string) => {
  if (!task || task.messagePool.length === 0) {
    return {
      key: `fallback:${runSeed}:0`,
      text: FALLBACK_FUN_MESSAGES[hashString(runSeed) % FALLBACK_FUN_MESSAGES.length],
    };
  }

  const hash = hashString(`${runSeed}:${task.name}`);
  const index = hash % task.messagePool.length;
  return {
    key: `${runSeed}:${task.name}:${index}`,
    text: task.messagePool[index],
  };
};

const getBootstrapTasks = (session: Session | null, guestMode: boolean, runSeed: string): AppBootstrapTask[] => {
  const userId = session?.user?.id || '';
  const hasUser = Boolean(userId) && !guestMode;

  const blockingTasks: AppBootstrapTask[] = [
    {
      name: 'route-chunks',
      label: 'Warming major screens',
      weight: 26,
      blocking: true,
      group: 'route-chunks',
      messagePool: buildTaskMessagePool('route-chunks', [
        'switching on every screen before rounds notices.',
        'staging the big screens like coffee depends on it.',
        'lining up dashboard, search, and newsfeed in formation.',
      ], runSeed).map((entry) => entry.text),
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
      messagePool: buildTaskMessagePool('search-data', [
        'sorting the case archive before conference panic hits.',
        'indexing cases for one-keyword search heroics.',
        'making diagnostic chaos searchable.',
      ], runSeed).map((entry) => entry.text),
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
      messagePool: buildTaskMessagePool('article-library-data', [
        'waking the pathology shelf up.',
        'stacking the checklists in consultant order.',
        'getting the teaching files presentable.',
      ], runSeed).map((entry) => entry.text),
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
            messagePool: buildTaskMessagePool('dashboard-snapshot', [
              'checking if the dashboard survived duty handoff.',
              'straightening the home screen for rounds.',
              'polishing the dashboard before questions start.',
            ], runSeed).map((entry) => entry.text),
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
            messagePool: buildTaskMessagePool('unread-count-and-newsfeed', [
              'sorting the newsfeed chaos.',
              'counting unread alerts before they multiply.',
              'pulling urgent notices to the front.',
            ], runSeed).map((entry) => entry.text),
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
            messagePool: buildTaskMessagePool('profile-data', [
              'straightening the profile page.',
              'polishing the profile details.',
              'setting the profile view in order.',
            ], runSeed).map((entry) => entry.text),
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
            messagePool: buildTaskMessagePool('calendar-data', [
              'untangling the calendar.',
              'arranging the schedule for group-chat questions.',
              'getting call coverage into shape.',
            ], runSeed).map((entry) => entry.text),
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
            messagePool: buildTaskMessagePool('activity-data', [
              'replaying the latest activity.',
              'following the freshest breadcrumbs.',
              'checking who moved what.',
            ], runSeed).map((entry) => entry.text),
            run: async () => {
              await fetchRecentActivity(userId, 20);
            },
          },
          {
            name: 'quiz-data',
            label: 'Preparing quiz workspace',
            weight: 6,
            blocking: true,
            group: 'major-screen-data',
            messagePool: buildTaskMessagePool('quiz-data', [
              'warming the quiz lab.',
              'stacking the quiz sessions.',
              'setting out the trick questions.',
            ], runSeed).map((entry) => entry.text),
            run: async () => {
              await preloadQuizWorkspace();
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
      messagePool: buildTaskMessagePool('anatomy-route-chunk', [
        'quietly wheeling anatomy into the reading room for later.',
      ], runSeed).map((entry) => entry.text),
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
  runSeed: string,
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
  const funMessage = stableMessageForTask(activeTask, runSeed);
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
    funMessage: funMessage.text,
    funMessageKey: funMessage.key,
  };
};

export const startAppBootstrap = async (options: {
  session: Session | null;
  guestMode: boolean;
  timeoutMs?: number;
  onProgress?: (snapshot: AppBootstrapProgressSnapshot) => void;
}): Promise<AppBootstrapResult> => {
  const runSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const tasks = getBootstrapTasks(options.session, options.guestMode, runSeed);
  const blockingTasks = tasks.filter((task) => task.blocking);
  const backgroundTasks = tasks.filter((task) => !task.blocking);
  const results = new Map<AppBootstrapTaskName, AppBootstrapTaskResult>();

  const emitProgress = (releaseReady = false) => {
    options.onProgress?.(buildProgressSnapshot(tasks, results, releaseReady, runSeed));
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
  buildResidentFunMessage,
  RESIDENT_BOOT_NAMES,
};
