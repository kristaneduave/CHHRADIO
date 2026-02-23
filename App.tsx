
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadScreen from './components/UploadScreen';
import QuizScreen from './components/QuizScreen';
import SearchScreen from './components/SearchScreen';
import CalendarScreen from './components/CalendarScreen';
import ProfileScreen from './components/ProfileScreen';
import AnnouncementsScreen from './components/AnnouncementsScreen';
import LoginScreen from './components/LoginScreen';
import CaseViewScreen from './components/CaseViewScreen';
import ResidentsCornerScreen from './components/ResidentsCornerScreen';
import NewsfeedScreen from './components/NewsfeedScreen';
import ToastHost from './components/ToastHost';
import LoadingState from './components/LoadingState';
import { Screen, SubmissionType } from './types';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { useThemePreference } from './utils/theme';
import {
  APP_OPEN_STORAGE_KEY,
  SNAPSHOT_BASELINE_STORAGE_KEY,
  SNAPSHOT_SEEN_ANNOUNCEMENTS_KEY,
  SNAPSHOT_SEEN_CALENDAR_KEY,
  SNAPSHOT_SEEN_CASES_KEY,
} from './services/dashboardSnapshotService';

const RECENT_SCREENS_STORAGE_KEY = 'chh_recent_screens';
const TRACKABLE_SCREENS: Screen[] = [
  'newsfeed',
  'search',
  'calendar',
  'announcements',
  'upload',
  'quiz',
  'residents-corner',
  'profile',
];

const App: React.FC = () => {
  useThemePreference();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseToEdit, setCaseToEdit] = useState<any>(null);
  const [initialUploadType, setInitialUploadType] = useState<SubmissionType>('interesting_case');

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
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateRecentScreens = (screen: Screen) => {
    if (typeof window === 'undefined' || !TRACKABLE_SCREENS.includes(screen)) return;
    const raw = window.localStorage.getItem(RECENT_SCREENS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Screen[]) : [];
    const next = [screen, ...parsed.filter((entry) => entry !== screen)].slice(0, 2);
    window.localStorage.setItem(RECENT_SCREENS_STORAGE_KEY, JSON.stringify(next));
  };

  const navigateToScreen = (screen: Screen) => {
    if (typeof window !== 'undefined') {
      const nowIso = new Date().toISOString();
      if (screen === 'announcements') {
        window.localStorage.setItem(SNAPSHOT_SEEN_ANNOUNCEMENTS_KEY, nowIso);
      }
      if (screen === 'calendar') {
        window.localStorage.setItem(SNAPSHOT_SEEN_CALENDAR_KEY, nowIso);
      }
      if (screen === 'search' || screen === 'database') {
        window.localStorage.setItem(SNAPSHOT_SEEN_CASES_KEY, nowIso);
      }
    }

    setCurrentScreen(screen);
    updateRecentScreens(screen);
  };

  const startUploadFlow = (submissionType: SubmissionType) => {
    setCaseToEdit(null);
    setInitialUploadType(submissionType);
    navigateToScreen('upload');
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
        return <AnnouncementsScreen />;
      case 'newsfeed':
        return <NewsfeedScreen />;
      case 'residents-corner':
        return <ResidentsCornerScreen />;
      default:
        return <Dashboard onNavigate={navigateToScreen} onStartUpload={startUploadFlow} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center text-text-primary px-4">
        <LoadingState title="Loading workspace..." compact />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <>
      <Layout activeScreen={currentScreen} setScreen={navigateToScreen}>
        {renderScreen()}
      </Layout>
      <ToastHost />
    </>
  );
};

export default App;
