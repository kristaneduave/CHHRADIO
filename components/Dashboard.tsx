

import React, { useEffect, useState } from 'react';
import { QUICK_ACTIONS, PROFILE_IMAGE } from '../constants';
import { Screen } from '../types';
import { supabase } from '../services/supabase';

import NotificationCenter from './NotificationCenter';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('Doctor');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to fetch profile name
        const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();
        if (data) {
          if (data.full_name) setUserName(data.full_name);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
        } else if (user.email) {
          setUserName(user.email.split('@')[0]);
        }
      }
    };
    fetchProfile();
  }, []);

  return (
    <>
      <header className="flex justify-between items-center px-6 pt-12 pb-8">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => onNavigate('profile')}>
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/50 to-transparent rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative p-0.5 rounded-full border border-white/10 glass-card-enhanced">
              <img alt="Profile" className="w-12 h-12 rounded-full object-cover border border-background-dark shadow-inner" src={avatarUrl || PROFILE_IMAGE} />
            </div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-0.5">Welcome Back</h2>
            <h1 className="text-xl font-bold text-white">Dr. {userName}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowNotifications(true)}
          className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all relative"
        >
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050B14]"></span>
          <span className="material-icons text-xl">notifications</span>
        </button>
      </header>

      <section className="px-6 mb-8">
        <h3 className="text-sm font-medium text-slate-400 mb-4 ml-1">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="glass-card-enhanced rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3 group hover:border-primary/50 transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-[0_0_20px_-5px_rgba(13,162,231,0.4)]">
                <span className="material-icons text-2xl">{action.icon}</span>
              </div>
              <span className="text-sm font-semibold text-slate-200 group-hover:text-white">{action.label}</span>
            </button>
          ))}
        </div>
      </section>



      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
};

export default Dashboard;
