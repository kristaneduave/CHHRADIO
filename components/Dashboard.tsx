
import React, { useEffect, useState } from 'react';
import { ACTIVITIES, QUICK_ACTIONS, PROFILE_IMAGE } from '../constants';
import { Screen } from '../types';
import { supabase } from '../services/supabase';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [userName, setUserName] = useState('Doctor');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Try to fetch profile name, or fall back to email username
        const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        if (data?.full_name) {
          setUserName(data.full_name);
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
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/50 to-transparent rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative p-0.5 rounded-full border border-white/10 glass-card-enhanced">
              <img alt="Profile" className="w-12 h-12 rounded-full object-cover border border-background-dark shadow-inner" src={PROFILE_IMAGE} />
            </div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-0.5">Welcome Back</h2>
            <h1 className="text-xl font-bold text-white">Dr. {userName}</h1>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all relative">
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

      <section className="px-6 flex-1">
        <div className="flex justify-between items-center mb-4 ml-1">
          <h3 className="text-sm font-medium text-slate-400">Recent Activity</h3>
          <button className="text-xs text-primary hover:text-primary-dark font-medium transition-colors">View All</button>
        </div>
        <div className="flex flex-col gap-3">
          {ACTIVITIES.map((activity) => (
            <div
              key={activity.id}
              className="glass-card-enhanced p-4 rounded-xl flex items-center gap-4 hover:bg-white/5 border border-white/5 hover:border-primary/30 transition-all cursor-pointer group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${activity.colorClass} border-white/10`}>
                <span className="material-icons text-lg text-inherit">{activity.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white truncate">{activity.title}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{activity.subtitle}</p>
              </div>
              <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{activity.time}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default Dashboard;
