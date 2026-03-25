
import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import ToastHost from './components/ToastHost';
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
  loadLiveAuntMinnieScreen,
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
  'live-aunt-minnie',
  'residents-corner',
  'article-library',
  'resident-endorsements',
  'profile',
];

const UploadScreen = lazy(loadUploadScreen);
const QuizScreen = lazy(loadQuizScreen);
const LiveAuntMinnieScreen = lazy(loadLiveAuntMinnieScreen);
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
const APP_INSTANCE_ID = `radcore-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const isDevRuntime = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
const getBootProgressTweenDuration = (delta: number, isFinalStep: boolean) => {
  if (isFinalStep) return 260;
  if (delta <= 8) return 220;
  if (delta <= 24) return 360;
  return 560;
};

const App: React.FC = () => {
  useThemePreference();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [isBootReady, setIsBootReady] = useState(false);
  const [isBootCompleting, setIsBootCompleting] = useState(false);
  const [rawBootProgress, setRawBootProgress] = useState(0);
  const [displayBootProgress, setDisplayBootProgress] = useState(0);
  const [bootStatusLabel, setBootStatusLabel] = useState('Checking session');
  const [bootPhaseLabel, setBootPhaseLabel] = useState('Resolving access');
  const [bootFunMessage, setBootFunMessage] = useState('Checking if the residents broke the dashboard again...');
  const [bootFunMessageKey, setBootFunMessageKey] = useState('session:checking');
  const [bootFunMessagePool, setBootFunMessagePool] = useState<string[]>(['Checking if the residents broke the dashboard again...']);
  const [bootTaskSummary, setBootTaskSummary] = useState({ completed: 0, total: 0 });
  const [bootPrincipalKey, setBootPrincipalKey] = useState<string | null>(null);
  const [caseToEdit, setCaseToEdit] = useState<any>(null);
  const [initialUploadType, setInitialUploadType] = useState<SubmissionType>('interesting_case');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingAnnouncementId, setPendingAnnouncementId] = useState<string | null>(null);
  const hasReleasedBootRef = useRef(false);
  const bootExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootProgressTweenRef = useRef<number | null>(null);
  const displayBootProgressRef = useRef(0);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  });
  const principalKey = session?.user?.id ? `user:${session.user.id}` : guestMode ? 'guest' : 'anon';
  const debugLifecycle = React.useCallback((label: string, details?: Record<string, unknown>) => {
    if (!isDevRuntime) return;
    console.log(`[app:${APP_INSTANCE_ID}] ${label}`, details || {});
  }, []);

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
    return () => {
      if (bootExitTimerRef.current) {
        clearTimeout(bootExitTimerRef.current);
      }
      if (bootProgressTweenRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(bootProgressTweenRef.current);
      }
    };
  }, []);

  useEffect(() => {
    displayBootProgressRef.current = displayBootProgress;
  }, [displayBootProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplayBootProgress(rawBootProgress);
      return;
    }

    if (bootProgressTweenRef.current !== null) {
      window.cancelAnimationFrame(bootProgressTweenRef.current);
      bootProgressTweenRef.current = null;
    }

    const target = isBootReady ? 100 : Math.min(rawBootProgress, 99);
    const current = displayBootProgressRef.current;

    if (Math.abs(target - current) < 0.5) {
      if (current !== target) {
        setDisplayBootProgress(target);
        displayBootProgressRef.current = target;
      }
      return;
    }

    const start = performance.now();
    const initial = current;
    const delta = target - initial;
    const duration = getBootProgressTweenDuration(Math.abs(delta), isBootReady && target === 100);

    const step = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = initial + delta * eased;
      const clampedValue = delta >= 0
        ? Math.min(nextValue, target)
        : Math.max(nextValue, target);

      displayBootProgressRef.current = clampedValue;
      setDisplayBootProgress(clampedValue);

      if (progress < 1) {
        bootProgressTweenRef.current = window.requestAnimationFrame(step);
      } else {
        bootProgressTweenRef.current = null;
      }
    };

    bootProgressTweenRef.current = window.requestAnimationFrame(step);

    return () => {
      if (bootProgressTweenRef.current !== null) {
        window.cancelAnimationFrame(bootProgressTweenRef.current);
        bootProgressTweenRef.current = null;
      }
    };
  }, [isBootReady, rawBootProgress]);

  useEffect(() => {
    debugLifecycle('mount', { principalKey });
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
      debugLifecycle('auth:getSession:resolved', {
        hasSession: Boolean(session),
        userId: session?.user?.id || null,
      });
      setSession(session);
      if (session && typeof window !== 'undefined') {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
        setGuestMode(false);
      }
      setIsSessionResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugLifecycle('auth:onAuthStateChange', {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id || null,
      });
      setSession(session);
      if (session && typeof window !== 'undefined') {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
        setGuestMode(false);
      }
      setIsSessionResolved(true);
    });

    return () => {
      debugLifecycle('unmount');
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSessionResolved) return;
    if (principalKey === 'anon') {
      debugLifecycle('bootstrap:idle-anon');
      hasReleasedBootRef.current = false;
      setBootPrincipalKey(null);
      setIsBootReady(false);
      setIsBootCompleting(false);
      setRawBootProgress(0);
      setDisplayBootProgress(0);
      return;
    }

    if (hasReleasedBootRef.current && bootPrincipalKey === principalKey) {
      debugLifecycle('bootstrap:skip-same-principal', { principalKey });
      return;
    }

    let isCancelled = false;
    debugLifecycle('bootstrap:start', {
      principalKey,
      previousPrincipalKey: bootPrincipalKey,
      guestMode,
      userId: session?.user?.id || null,
    });

    hasReleasedBootRef.current = false;
    setIsBootReady(false);
    setIsBootCompleting(false);
    setRawBootProgress(0);
    setDisplayBootProgress(0);
    setBootPhaseLabel('Preparing workspace shell');
    setBootStatusLabel('Preparing workspace');
    setBootFunMessage('Preparing your workspace and checking the launch path.');
    setBootFunMessageKey('bootstrap:preparing');
    setBootFunMessagePool([
      'Preparing your workspace and checking the launch path.',
      'Opening the reading room with just enough professionalism.',
      'Checking whether the portal had coffee before you did.',
    ]);
    setBootTaskSummary({ completed: 0, total: 0 });

    const runBootstrap = async () => {
      const result = await startAppBootstrap({
        session,
        guestMode,
        onProgress: (snapshot) => {
          if (isCancelled) return;
          setRawBootProgress(snapshot.progressPct);
          setBootStatusLabel(snapshot.statusLabel);
          setBootPhaseLabel(snapshot.phaseLabel);
          setBootFunMessage(snapshot.funMessage);
          setBootFunMessageKey(snapshot.funMessageKey);
          setBootFunMessagePool(snapshot.funMessagePool);
          setBootTaskSummary({
            completed: snapshot.completedTaskCount,
            total: snapshot.totalTaskCount,
          });
        },
      });

      if (isCancelled) return;
      debugLifecycle('bootstrap:complete', {
        principalKey,
        releaseReason: result.releaseReason,
        tasks: result.tasks.map((task) => ({
          name: task.name,
          status: task.status,
          blocking: task.blocking,
        })),
      });
      setRawBootProgress(100);
      setBootPhaseLabel('Opening workspace');
      setBootStatusLabel('Opening workspace');
      setBootFunMessage('The reading room is staged and ready for entry.');
      setBootFunMessageKey('bootstrap:complete');
      setBootFunMessagePool([
        'The reading room is staged and ready for entry.',
        'Everything looks prepared enough to be convincing.',
        'The portal is open and pretending this was effortless.',
      ]);
      setIsBootCompleting(true);
      setIsBootReady(true);
      if (bootExitTimerRef.current) {
        clearTimeout(bootExitTimerRef.current);
      }
      bootExitTimerRef.current = setTimeout(() => {
        setIsBootCompleting(false);
      }, 260);
      setBootPrincipalKey(principalKey);
      hasReleasedBootRef.current = true;
      void result.backgroundPromise.catch((error) => console.error('Background bootstrap failed:', error));
    };

    runBootstrap().catch((error) => {
      console.error('App bootstrap failed:', error);
      debugLifecycle('bootstrap:error', {
        principalKey,
        message: error instanceof Error ? error.message : String(error),
      });
      if (isCancelled) return;
      setRawBootProgress(100);
      setBootPhaseLabel('Opening workspace');
      setBootStatusLabel('Opening workspace');
      setBootFunMessage('Opening the reading room despite one dramatic scanner.');
      setBootFunMessageKey('bootstrap:error');
      setBootFunMessagePool([
        'Opening the reading room despite one dramatic scanner.',
        'One dataset complained, but the portal kept walking.',
        'We lost a little composure, not the workspace.',
      ]);
      setIsBootCompleting(true);
      setIsBootReady(true);
      if (bootExitTimerRef.current) {
        clearTimeout(bootExitTimerRef.current);
      }
      bootExitTimerRef.current = setTimeout(() => {
        setIsBootCompleting(false);
      }, 260);
      setBootPrincipalKey(principalKey);
      hasReleasedBootRef.current = true;
    });

    return () => {
      isCancelled = true;
    };
  }, [bootPrincipalKey, debugLifecycle, guestMode, isSessionResolved, principalKey, session]);

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
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      debugLifecycle('page:visibilitychange', { hidden: document.hidden });
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      debugLifecycle('page:pageshow', { persisted: event.persisted });
    };
    const handlePageHide = (event: PageTransitionEvent) => {
      debugLifecycle('page:pagehide', { persisted: event.persisted });
    };
    const handleBeforeUnload = () => {
      debugLifecycle('page:beforeunload');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [debugLifecycle]);

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
      debugLifecycle('presence:visibilitychange', { hidden: document.hidden, userId: uid });
      tracker.setVisible(!document.hidden);
    };
    const handleBeforeUnload = () => {
      debugLifecycle('presence:beforeunload', { userId: uid });
      tracker.stop();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      tracker.stop();
    };
  }, [debugLifecycle, session?.user?.id]);

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
              const wasEditing = Boolean(caseToEdit);
              setCaseToEdit(null);
              navigateToScreen(wasEditing ? 'profile' : 'dashboard');
            }}
          />
        );
      case 'quiz':
        return <QuizScreen onOpenLiveAuntMinnie={() => navigateToScreen('live-aunt-minnie')} />;
      case 'live-aunt-minnie':
        return <LiveAuntMinnieScreen onBack={() => navigateToScreen('quiz')} />;
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
              setInitialUploadType((caseToEdit?.submission_type as SubmissionType) || 'interesting_case');
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
            currentUserId={session?.user?.id || null}
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
            currentUserId={session?.user?.id || null}
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

  const bootScreenMode = !isSessionResolved ? 'session' : 'bootstrap';
  const shouldShowBootScreen = !isSessionResolved || ((Boolean(session) || guestMode) && (!isBootReady || isBootCompleting));
  const canRenderAppShell = isSessionResolved && (Boolean(session) || guestMode) && isBootReady;

  if (isSessionResolved && !session && !guestMode) {
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

  return (
    <>
      <AnimatePresence>
        {shouldShowBootScreen ? (
          <AppBootScreen
            key={bootScreenMode}
            mode={bootScreenMode}
            progress={displayBootProgress}
            statusLabel={bootStatusLabel}
            phaseLabel={bootPhaseLabel}
            funMessage={bootScreenMode === 'session' ? 'Checking session access and preparing a clean launch.' : bootFunMessage}
            funMessages={bootScreenMode === 'session' ? ['Checking session access and preparing a clean launch.'] : bootFunMessagePool}
            messageKey={bootScreenMode === 'session' ? 'session:checking' : bootFunMessageKey}
            taskSummary={bootTaskSummary}
            isComplete={bootScreenMode === 'bootstrap' && isBootReady}
          />
        ) : null}
      </AnimatePresence>
      {canRenderAppShell ? (
        <>
          <Layout
            activeScreen={currentScreen}
            setScreen={navigateToScreen}
            prefetchScreen={prefetchScreen}
            unreadNotificationsCount={unreadNotificationsCount}
          >
            <Suspense fallback={null}>
              {renderScreen()}
            </Suspense>
          </Layout>
          <ToastHost />
        </>
      ) : null}
    </>
  );
};

export default App;
