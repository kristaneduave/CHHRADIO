
import React, { useState, useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import ToastHost from './components/ToastHost';
import LoadingState from './components/LoadingState';
import AppBootScreen from './components/AppBootScreen';
import { Screen, SubmissionType } from './types';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { useThemePreference } from './utils/theme';
import {
  APP_OPEN_STORAGE_KEY,
  SNAPSHOT_BASELINE_STORAGE_KEY,
  markSnapshotSectionsSeenForScreen,
} from './services/dashboardSnapshotService';
import { fetchUnreadNotificationsCount, subscribeToNotifications } from './services/newsfeedService';
import { createAppPresenceTracker } from './services/newsfeedPresenceService';
import {
  loadAnatomyScreen,
  loadAnnouncementsScreen,
  loadArticleLibraryScreen,
  loadCalendarScreen,
  loadCaseViewScreen,
  loadMonthlyCensusPage,
  loadNewsfeedScreen,
  loadProfileScreen,
  loadQuizScreen,
  loadResidentEndorsementsScreen,
  loadResidentsCornerScreen,
  loadSearchScreen,
  loadUploadScreen,
  preloadRouteForScreen,
} from './services/routePreloadService';
import { startAppBootstrap } from './services/appBootstrapService';

declare global {
  interface NetworkInformation {
    saveData?: boolean;
  }
  interface Navigator {
    connection?: NetworkInformation;
  }
}

const RECENT_SCREENS_STORAGE_KEY = 'chh_recent_screens';
const GUEST_MODE_STORAGE_KEY = 'chh_guest_mode';
const TRACKABLE_SCREENS: Screen[] = [
  'newsfeed',
  'search',
  'calendar',
  'announcements',
  'upload',
  'quiz',
  'residents-corner',
  'article-library',
  'resident-endorsements',
  'profile',
];

const UploadScreen = lazy(loadUploadScreen);
const QuizScreen = lazy(loadQuizScreen);
const SearchScreen = lazy(loadSearchScreen);
const CalendarScreen = lazy(loadCalendarScreen);
const ProfileScreen = lazy(loadProfileScreen);
const AnnouncementsScreen = lazy(loadAnnouncementsScreen);
const CaseViewScreen = lazy(loadCaseViewScreen);
const ResidentsCornerScreen = lazy(loadResidentsCornerScreen);
const ResidentEndorsementsScreen = lazy(loadResidentEndorsementsScreen);
const ArticleLibraryScreen = lazy(loadArticleLibraryScreen);
const NewsfeedScreen = lazy(loadNewsfeedScreen);
const AnatomyComingSoonScreen = lazy(loadAnatomyScreen);
const MonthlyCensusPage = lazy(loadMonthlyCensusPage);

const App: React.FC = () => {
  useThemePreference();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [isBootReady, setIsBootReady] = useState(false);
  const [bootProgress, setBootProgress] = useState(8);
  const [bootStatusLabel, setBootStatusLabel] = useState('Checking session');
  const [caseToEdit, setCaseToEdit] = useState<any>(null);
  const [initialUploadType, setInitialUploadType] = useState<SubmissionType>('interesting_case');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingAnnouncementId, setPendingAnnouncementId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  });

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-app text-text-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-error/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-icons text-3xl text-red-500">error_outline</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-3">Configuration Missing</h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            The Supabase environment variables are missing. Please add them to your Vercel project settings.
          </p>
          <div className="bg-app rounded-lg p-4 text-left border border-border-default mb-6">
            <code className="text-xs text-text-secondary block mb-1">Make sure these are set:</code>
            <code className="text-xs text-primary block font-mono">VITE_SUPABASE_URL</code>
            <code className="text-xs text-primary block font-mono">VITE_SUPABASE_ANON_KEY</code>
          </div>
          <p className="text-xs text-text-tertiary">After adding them, redeploy your project.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const previousOpenAt = window.localStorage.getItem(APP_OPEN_STORAGE_KEY);
      if (previousOpenAt) {
        window.localStorage.setItem(SNAPSHOT_BASELINE_STORAGE_KEY, previousOpenAt);
      } else {
        window.localStorage.removeItem(SNAPSHOT_BASELINE_STORAGE_KEY);
      }
      window.localStorage.setItem(APP_OPEN_STORAGE_KEY, new Date().toISOString());
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && typeof window !== 'undefined') {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
        setGuestMode(false);
      }
      setIsSessionResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && typeof window !== 'undefined') {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
        setGuestMode(false);
      }
      setIsSessionResolved(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSessionResolved) return;
    if (!session && !guestMode) {
      setIsBootReady(false);
      return;
    }

    let isCancelled = false;
    setIsBootReady(false);
    setBootProgress(15);
    setBootStatusLabel('Preparing dashboard');

    const runBootstrap = async () => {
      const result = await startAppBootstrap({
        session,
        guestMode,
        timeoutMs: 5_000,
        onProgress: (snapshot) => {
          if (isCancelled) return;
          setBootProgress(snapshot.progressPct);
          setBootStatusLabel(snapshot.statusLabel);
        },
      });

      if (isCancelled) return;
      setBootProgress(100);
      setBootStatusLabel('Opening workspace');
      setIsBootReady(true);
      void result.backgroundPromise.catch((error) => console.error('Background bootstrap failed:', error));
    };

    runBootstrap().catch((error) => {
      console.error('App bootstrap failed:', error);
      if (isCancelled) return;
      setBootProgress(100);
      setBootStatusLabel('Opening workspace');
      setIsBootReady(true);
    });

    return () => {
      isCancelled = true;
    };
  }, [guestMode, isSessionResolved, session]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setUnreadNotificationsCount(0);
      return;
    }

    let mounted = true;
    const refreshUnreadCount = async () => {
      try {
        const count = await fetchUnreadNotificationsCount(uid);
        if (mounted) {
          setUnreadNotificationsCount(count);
        }
      } catch (error) {
        console.error('Failed to refresh unread notifications count:', error);
      }
    };

    refreshUnreadCount();
    const unsubscribe = subscribeToNotifications(uid, () => {
      refreshUnreadCount().catch((error) => console.error('Failed to refresh unread notifications count:', error));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [session?.user?.id]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const tracker = createAppPresenceTracker({
      currentUserId: uid,
      onError: (message) => console.error(message),
    });

    tracker.start();
    tracker.setVisible(!document.hidden);

    const handleVisibilityChange = () => {
      tracker.setVisible(!document.hidden);
    };
    const handleBeforeUnload = () => {
      tracker.stop();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      tracker.stop();
    };
  }, [session?.user?.id]);

  const updateRecentScreens = (screen: Screen) => {
    if (typeof window === 'undefined' || !TRACKABLE_SCREENS.includes(screen)) return;
    const raw = window.localStorage.getItem(RECENT_SCREENS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Screen[]) : [];
    const next = [screen, ...parsed.filter((entry) => entry !== screen)].slice(0, 2);
    window.localStorage.setItem(RECENT_SCREENS_STORAGE_KEY, JSON.stringify(next));
  };

  const navigateToScreen = (screen: Screen) => {
    markSnapshotSectionsSeenForScreen(screen);
    if (screen !== 'announcements') {
      setPendingAnnouncementId(null);
    }

    setCurrentScreen(screen);
    updateRecentScreens(screen);
  };

  const handleNewsfeedNavigate = (screen: Screen, entityId?: string | null) => {
    if (screen === 'announcements') {
      setPendingAnnouncementId(entityId || null);
    }
    if (screen === 'database') {
      navigateToScreen('search');
      return;
    }
    navigateToScreen(screen);
  };

  const startUploadFlow = (submissionType: SubmissionType) => {
    setCaseToEdit(null);
    setInitialUploadType(submissionType);
    navigateToScreen('upload');
  };

  const prefetchScreen = (screen: Screen) => {
    void preloadRouteForScreen(screen).catch((error) => {
      console.error(`Failed to prefetch ${screen}:`, error);
    });
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateToScreen} onStartUpload={startUploadFlow} />;
      case 'upload':
        return (
          <UploadScreen
            existingCase={caseToEdit}
            initialSubmissionType={initialUploadType}
            onClose={() => {
              setCaseToEdit(null);
              navigateToScreen('profile'); // Return to profile after editing/closing
            }}
          />
        );
      case 'quiz':
        return <QuizScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'case-view':
        return (
          <CaseViewScreen
            caseData={caseToEdit}
            onBack={() => {
              setCaseToEdit(null);
              navigateToScreen('search');
            }}
            onEdit={() => {
              setInitialUploadType('interesting_case');
              navigateToScreen('upload'); // Navigate to upload for editing
            }}
          />
        );
      case 'database':
      case 'search':
        return (
          <SearchScreen
            onCaseSelect={(caseItem) => {
              setCaseToEdit(caseItem);
              navigateToScreen('case-view'); // Navigate to read-only view
            }}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onEditCase={(caseItem) => {
              setCaseToEdit(caseItem);
              navigateToScreen('case-view'); // Profile also goes to view mode first
            }}
            onViewCase={(caseItem) => {
              setCaseToEdit(caseItem);
              navigateToScreen('case-view');
            }}
          />
        );
      case 'announcements':
        return (
          <AnnouncementsScreen
            initialOpenAnnouncementId={pendingAnnouncementId}
            onHandledInitialOpen={() => setPendingAnnouncementId(null)}
          />
        );
      case 'newsfeed':
        return (
          <NewsfeedScreen
            onNavigateToTarget={handleNewsfeedNavigate}
            onUnreadCountChange={setUnreadNotificationsCount}
          />
        );
      case 'residents-corner':
        return (
          <ResidentsCornerScreen
            onOpenMonthlyCensus={() => navigateToScreen('monthly-census')}
            onOpenResidentEndorsements={() => navigateToScreen('resident-endorsements')}
          />
        );
      case 'article-library':
        return <ArticleLibraryScreen />;
      case 'resident-endorsements':
        return <ResidentEndorsementsScreen onBack={() => navigateToScreen('residents-corner')} />;
      case 'monthly-census':
        return (
          <MonthlyCensusPage
            residentId={session?.user?.id || null}
            onBack={() => navigateToScreen('residents-corner')}
            onHome={() => navigateToScreen('dashboard')}
            onSubmitted={() => navigateToScreen('dashboard')}
          />
        );
      case 'anatomy':
        return <AnatomyComingSoonScreen />;
      default:
        return <Dashboard onNavigate={navigateToScreen} onStartUpload={startUploadFlow} />;
    }
  };

  if (!isSessionResolved) {
    return <AppBootScreen progress={bootProgress} statusLabel={bootStatusLabel} />;
  }

  if (!session && !guestMode) {
    return (
      <LoginScreen
        onContinueWithoutAuth={() => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1');
          }
          setGuestMode(true);
        }}
      />
    );
  }

  if (!isBootReady) {
    return <AppBootScreen progress={bootProgress} statusLabel={bootStatusLabel} />;
  }

  return (
    <>
    <Layout
      activeScreen={currentScreen}
      setScreen={navigateToScreen}
      prefetchScreen={prefetchScreen}
      unreadNotificationsCount={unreadNotificationsCount}
    >
        <Suspense fallback={<LoadingState title="Loading module..." compact />}>
          {renderScreen()}
        </Suspense>
      </Layout>
      <ToastHost />
    </>
  );
};

export default App;
