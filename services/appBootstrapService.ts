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
const BOOT_MESSAGE_HISTORY_KEY = 'radcore:boot-message-history';
const MAX_RECENT_BOOT_MESSAGES = 24;
const bootMessageSelectionCache = new Map<string, { key: string; text: string }>();

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
const RESIDENT_BOOT_GROUPS = ['Anims', 'Ducks', 'NZs', 'PGTT', 'KTV'] as const;

const hashString = (value: string) =>
  Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const buildResidentFunMessage = (seed: string, actions: string[]) => {
  const primaryIndex = hashString(`${seed}:primary`) % RESIDENT_BOOT_NAMES.length;
  const primaryResident = RESIDENT_BOOT_NAMES[primaryIndex];
  const secondaryOffset = (hashString(`${seed}:secondary`) % (RESIDENT_BOOT_NAMES.length - 1)) + 1;
  const secondaryResident = RESIDENT_BOOT_NAMES[(primaryIndex + secondaryOffset) % RESIDENT_BOOT_NAMES.length];
  const tertiaryOffset = (hashString(`${seed}:tertiary`) % (RESIDENT_BOOT_NAMES.length - 2)) + 2;
  const tertiaryResident = RESIDENT_BOOT_NAMES[(primaryIndex + tertiaryOffset) % RESIDENT_BOOT_NAMES.length];
  const groupName = RESIDENT_BOOT_GROUPS[hashString(`${seed}:named-group`) % RESIDENT_BOOT_GROUPS.length];
  const leadVariants = [
    { kind: 'single', text: `${primaryResident} is` },
    { kind: 'pair', text: `${primaryResident} and ${secondaryResident} are` },
    { kind: 'trio', text: `${primaryResident}, ${secondaryResident}, and ${tertiaryResident} are` },
    { kind: 'group', text: `${groupName} are` },
  ] as const;

  const introVariants = [
    '',
    'already ',
    'quietly ',
    'still ',
  ];

  return actions.flatMap((action, index) =>
    leadVariants.flatMap((leadVariant) =>
      introVariants.map((intro, variantIndex) => ({
        key: `${seed}:${index}:${leadVariant.kind}:${variantIndex}`,
        text: `${leadVariant.text} ${intro}${action}`.replace(/\s+/g, ' ').trim(),
      }))
    )
  );
};

const buildTaskMessagePool = (taskName: AppBootstrapTaskName, actions: string[], runSeed: string) =>
  buildResidentFunMessage(`${runSeed}:${taskName}`, actions);

const readBootMessageHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOT_MESSAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const writeBootMessageHistory = (history: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOT_MESSAGE_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_RECENT_BOOT_MESSAGES)));
  } catch {
    // Ignore storage failures so boot copy never blocks startup.
  }
};

const stableMessageForTask = (task: AppBootstrapTask | null | undefined, runSeed: string) => {
  const cacheKey = `${runSeed}:${task?.name || 'fallback'}`;
  const cached = bootMessageSelectionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!task || task.messagePool.length === 0) {
    const fallbackMessage = {
      key: `fallback:${runSeed}:0`,
      text: FALLBACK_FUN_MESSAGES[hashString(runSeed) % FALLBACK_FUN_MESSAGES.length],
    };
    bootMessageSelectionCache.set(cacheKey, fallbackMessage);
    return fallbackMessage;
  }

  const messageHistory = readBootMessageHistory();
  const candidateIndexes = Array.from({ length: task.messagePool.length }, (_, index) => index);
  const orderedIndexes = candidateIndexes
    .map((index) => ({
      index,
      rank: hashString(`${runSeed}:${task.name}:${index}`),
    }))
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.index);

  const pickIndex = orderedIndexes.find((index) => !messageHistory.includes(`${task.name}:${index}`)) ?? orderedIndexes[0] ?? 0;
  const selectedMessage = {
    key: `${runSeed}:${task.name}:${pickIndex}`,
    text: task.messagePool[pickIndex],
  };

  writeBootMessageHistory([`${task.name}:${pickIndex}`, ...messageHistory.filter((entry) => entry !== `${task.name}:${pickIndex}`)]);
  bootMessageSelectionCache.set(cacheKey, selectedMessage);
  return selectedMessage;
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
        'switching on the main screens.',
        'lining up dashboard, search, and newsfeed.',
        'getting the reading-room controls to behave.',
        'opening the major rooms.',
        'waking the whole shell up.',
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
        'sorting the case archive.',
        'indexing cases for one-keyword searches.',
        'making diagnostic chaos searchable.',
        'lining up the teaching files.',
        'putting the archive in order.',
        'making the old cases easier to find.',
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
        'stacking the checklists in order.',
        'getting the teaching files presentable.',
        'straightening the article shelf.',
        'pulling the reporting pearls together.',
        'setting the article room up.',
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
              'checking if the dashboard survived handoff.',
              'straightening the home screen.',
              'polishing the dashboard.',
              'making the front page look calmer.',
              'lining up the home screen.',
              'getting the command deck presentable.',
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
              'counting unread alerts.',
              'pulling urgent notices to the front.',
              'untangling announcements.',
              'putting the updates where people can find them.',
              'stacking fresh alerts.',
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
              'making the profile corner look prepared.',
              'arranging the resident details.',
              'getting the personal workspace ready.',
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
              'arranging the schedule.',
              'getting call coverage into shape.',
              'convincing the duty roster to behave.',
              'lining up the schedule.',
              'putting the calendar back together.',
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
              'tracking the latest clicks.',
              'reading the recent trail.',
              'checking the latest movement through the portal.',
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
              'lining up the quiz room.',
              'getting the question bank ready.',
              'preparing the quiz corner.',
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
        'parking the anatomy atlas for later.',
        'bringing the anatomy shelf in.',
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
  RESIDENT_BOOT_GROUPS,
  resetBootMessageSelectionCache: () => {
    bootMessageSelectionCache.clear();
  },
};
