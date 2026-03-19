import { Screen } from '../types';

const memoizeImport = <T,>(loader: () => Promise<T>) => {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) {
      promise = loader();
    }
    return promise;
  };
};

export const loadUploadScreen = memoizeImport(() => import('../components/UploadScreen'));
export const loadQuizScreen = memoizeImport(() => import('../components/QuizScreen'));
export const loadSearchScreen = memoizeImport(() => import('../components/SearchScreen'));
export const loadCalendarScreen = memoizeImport(() => import('../components/CalendarScreen'));
export const loadProfileScreen = memoizeImport(() => import('../components/ProfileScreen'));
export const loadAnnouncementsScreen = memoizeImport(() => import('../components/AnnouncementsScreen'));
export const loadCaseViewScreen = memoizeImport(() => import('../components/CaseViewScreen'));
export const loadResidentsCornerScreen = memoizeImport(() => import('../components/ResidentsCornerScreen'));
export const loadResidentEndorsementsScreen = memoizeImport(() => import('../components/ResidentEndorsementsScreen'));
export const loadArticleLibraryScreen = memoizeImport(() => import('../components/ArticleLibraryScreen'));
export const loadNewsfeedScreen = memoizeImport(() => import('../components/NewsfeedScreen'));
export const loadAnatomyScreen = memoizeImport(() => import('../components/AnatomyComingSoonScreen'));
export const loadMonthlyCensusPage = memoizeImport(() => import('../components/MonthlyCensusPage'));

const SCREEN_PRELOADERS: Partial<Record<Screen, () => Promise<unknown>>> = {
  upload: loadUploadScreen,
  quiz: loadQuizScreen,
  search: loadSearchScreen,
  database: loadSearchScreen,
  calendar: loadCalendarScreen,
  profile: loadProfileScreen,
  announcements: loadAnnouncementsScreen,
  'case-view': loadCaseViewScreen,
  'residents-corner': loadResidentsCornerScreen,
  'resident-endorsements': loadResidentEndorsementsScreen,
  'article-library': loadArticleLibraryScreen,
  newsfeed: loadNewsfeedScreen,
  anatomy: loadAnatomyScreen,
  'monthly-census': loadMonthlyCensusPage,
};

export const preloadRouteForScreen = async (screen: Screen): Promise<void> => {
  await SCREEN_PRELOADERS[screen]?.();
};

export const preloadTopRouteChunks = async (): Promise<void> => {
  await Promise.all([
    loadNewsfeedScreen(),
    loadArticleLibraryScreen(),
    loadCalendarScreen(),
    loadSearchScreen(),
    loadProfileScreen(),
  ]);
};
