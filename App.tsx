
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
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
