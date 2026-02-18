
import React, { useState } from 'react';
import { QUICK_ACTIONS, MOCK_EVENTS, MOCK_ANNOUNCEMENTS } from '../constants';
import { Screen } from '../types';
import NotificationCenter from './NotificationCenter';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  // Get "Today at a Glance" data
  const nextEvent = MOCK_EVENTS.find(e => new Date(e.start_time) > new Date());
  const latestAnnouncement = MOCK_ANNOUNCEMENTS[0];

  return (
    <div className="min-h-screen bg-[#050B14]">
      {/* Typographic Header (Clean & Premium) */}
      <header className="relative flex flex-col items-center justify-center pt-24 pb-12 px-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-400 tracking-[0.25em] drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            CHH RADIOLOGY
          </h1>
          <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto rounded-full"></div>
        </div>
      </header>

      {/* Floating Notification Bell (Bottom Right) */}
      <button
        onClick={() => setShowNotifications(true)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-lg z-50 border border-white/10 hover:scale-105 active:scale-95"
      >
        <span className="absolute top-3 right-3.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050B14]"></span>
        <span className="material-icons text-xl">notifications</span>
      </button>

      {/* Centered Quick Actions (Compact Mobile) */}
      <section className="px-6 flex-1 flex flex-col items-center max-w-sm mx-auto w-full pb-8">
        <div className="w-full space-y-2">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="w-full glass-card-enhanced rounded-xl p-2.5 flex items-center gap-3 group hover:bg-white/5 transition-all text-left active:scale-[0.98] border border-white/5 hover:border-white/10 relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Subtle gradient background based on action color */}
              <div className={`absolute inset-0 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

              <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center ${action.color} group-hover:scale-105 transition-transform duration-300 relative z-10`}>
                <span className="material-icons text-lg">{action.icon}</span>
              </div>
              <div className="flex-1 relative z-10 min-w-0">
                <span className={`block text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate`}>{action.label}</span>
                <span className="block text-[10px] text-slate-500 font-medium group-hover:text-slate-400 transition-colors truncate">{action.subtitle}</span>
              </div>
              <span className={`material-icons ${action.color} opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-base relative z-10`}>arrow_forward_ios</span>
            </button>
          ))}
        </div>
      </section>

      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
};

export default Dashboard;
