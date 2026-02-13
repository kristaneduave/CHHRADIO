
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import UploadScreen from './components/UploadScreen';
import QuizScreen from './components/QuizScreen';
import SearchScreen from './components/SearchScreen';
import CalendarScreen from './components/CalendarScreen';
import ProfileScreen from './components/ProfileScreen';
import ChatScreen from './components/ChatScreen';
import BulletinScreen from './components/BulletinScreen';
import LoginScreen from './components/LoginScreen';
import { Screen } from './types';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#050B14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#101c22] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-icons text-3xl text-red-500">error_outline</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Configuration Missing</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            The Supabase environment variables are missing. Please add them to your Vercel project settings.
          </p>
          <div className="bg-[#050B14] rounded-lg p-4 text-left border border-white/5 mb-6">
            <code className="text-xs text-slate-500 block mb-1">Make sure these are set:</code>
            <code className="text-xs text-primary block font-mono">VITE_SUPABASE_URL</code>
            <code className="text-xs text-primary block font-mono">VITE_SUPABASE_ANON_KEY</code>
          </div>
          <p className="text-xs text-slate-600">After adding them, redeploy your project.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
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

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentScreen} />;
      case 'upload':
        return <UploadScreen />;
      case 'quiz':
        return <QuizScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'search':
        return <SearchScreen />;
      case 'chat':
        return <ChatScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'bulletin':
        return <BulletinScreen />;
      default:
        return <Dashboard onNavigate={setCurrentScreen} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B14] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <Layout activeScreen={currentScreen} setScreen={setCurrentScreen}>
      {renderScreen()}
    </Layout>
  );
};

export default App;
