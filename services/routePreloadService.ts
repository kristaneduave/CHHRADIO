import { Screen } from '../types';
import { preloadArticleLibraryLanding } from './articleLibraryService';
import { preloadAnnouncementsWorkspace } from './announcementsWorkspaceService';
import { preloadCalendarWorkspace } from './calendarWorkspaceService';
import { preloadCurrentLiveAuntMinnieRoom, preloadLiveAuntMinnieWorkspace } from './liveAuntMinnieService';
import { preloadCurrentProfileHome } from './profileHomeService';
import { preloadQuizWorkspace } from './quizService';
import { preloadConsultantDeckingEntries } from './consultantDeckingService';
import { preloadResidentsCornerBootstrap } from './residentsCornerService';

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
export const loadLiveAuntMinnieScreen = memoizeImport(() => import('../components/LiveAuntMinnieScreen'));
export const loadSearchScreen = memoizeImport(() => import('../components/SearchScreen'));
export const loadCalendarScreen = memoizeImport(() => import('../components/CalendarScreen'));
export const loadProfileScreen = memoizeImport(() => import('../components/ProfileScreen'));
export const loadAnnouncementsScreen = memoizeImport(() => import('../components/AnnouncementsScreen'));
export const loadCaseViewScreen = memoizeImport(() => import('../components/CaseViewScreen'));
export const loadPublicCaseShareScreen = memoizeImport(() => import('../components/PublicCaseShareScreen'));
export const loadResidentsCornerScreen = memoizeImport(() => import('../components/ResidentsCornerScreen'));
export const loadResidentEndorsementsScreen = memoizeImport(() => import('../components/ResidentEndorsementsScreen'));
export const loadConsultantDeckingBoardScreen = memoizeImport(() => import('../components/ConsultantDeckingBoardScreen'));
export const loadArticleLibraryScreen = memoizeImport(() => import('../components/ArticleLibraryScreen'));
export const loadNewsfeedScreen = memoizeImport(() => import('../components/NewsfeedScreen'));
export const loadAnatomyScreen = memoizeImport(() => import('../components/AnatomyComingSoonScreen'));
export const loadMonthlyCensusPage = memoizeImport(() => import('../components/MonthlyCensusPage'));

const SCREEN_PRELOADERS: Partial<Record<Screen, () => Promise<unknown>>> = {
  upload: loadUploadScreen,
  quiz: loadQuizScreen,
  'live-aunt-minnie': loadLiveAuntMinnieScreen,
  search: loadSearchScreen,
  database: loadSearchScreen,
  calendar: loadCalendarScreen,
  profile: loadProfileScreen,
  announcements: loadAnnouncementsScreen,
  'case-view': loadCaseViewScreen,
  'residents-corner': loadResidentsCornerScreen,
  'resident-endorsements': loadResidentEndorsementsScreen,
  'consultant-decking': loadConsultantDeckingBoardScreen,
  'article-library': loadArticleLibraryScreen,
  newsfeed: loadNewsfeedScreen,
  anatomy: loadAnatomyScreen,
  'monthly-census': loadMonthlyCensusPage,
};

const SCREEN_DATA_PRELOADERS: Partial<Record<Screen, () => Promise<unknown>>> = {
  'article-library': preloadArticleLibraryLanding,
  announcements: preloadAnnouncementsWorkspace,
  calendar: preloadCalendarWorkspace,
  profile: preloadCurrentProfileHome,
  quiz: async () => {
    await Promise.all([
      preloadQuizWorkspace(),
      preloadLiveAuntMinnieWorkspace(),
      preloadCurrentLiveAuntMinnieRoom(),
    ]);
  },
  'live-aunt-minnie': async () => {
    await Promise.all([
      preloadLiveAuntMinnieWorkspace(),
      preloadCurrentLiveAuntMinnieRoom(),
    ]);
  },
  'residents-corner': preloadResidentsCornerBootstrap,
  'consultant-decking': preloadConsultantDeckingEntries,
};

export const preloadRouteForScreen = async (screen: Screen): Promise<void> => {
  await Promise.all([
    SCREEN_PRELOADERS[screen]?.(),
    SCREEN_DATA_PRELOADERS[screen]?.(),
  ]);
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

export const preloadMajorRouteChunks = async (): Promise<void> => {
  await Promise.all([
    loadNewsfeedScreen(),
    loadSearchScreen(),
    loadProfileScreen(),
    loadCalendarScreen(),
    loadUploadScreen(),
    loadCaseViewScreen(),
    loadLiveAuntMinnieScreen(),
    loadAnnouncementsScreen(),
    loadResidentsCornerScreen(),
    loadResidentEndorsementsScreen(),
    loadConsultantDeckingBoardScreen(),
    loadArticleLibraryScreen(),
    loadQuizScreen(),
    loadMonthlyCensusPage(),
  ]);
};

export const preloadNonCriticalRouteChunks = async (): Promise<void> => {
  await Promise.all([
    loadAnatomyScreen(),
  ]);
};
