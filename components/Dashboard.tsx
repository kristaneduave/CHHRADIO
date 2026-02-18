
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
      {/* Ultra-Minimalist Header */}
      <header className="relative flex flex-col items-center justify-center pt-12 pb-8 px-6">
        <button
          onClick={() => setShowNotifications(true)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#050B14]"></span>
          <span className="material-icons text-lg">notifications</span>
        </button>

        <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-700">
          {/* X-Ray Logo Style */}
          <div className="relative w-14 h-14 bg-slate-900 rounded-xl border-2 border-slate-800 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)] flex items-center justify-center overflow-hidden">
            {/* X-Ray Blue Glow Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/20 to-cyan-500/10"></div>
            {/* Scanlines */}
            <div className="absolute inset-0 bg-[linear-gradient(transparent_2px,#000_3px)] opacity-30"></div>

            {/* Bone Icon */}
            <span className="material-icons text-cyan-100 text-3xl drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] relative z-10 opacity-90">
              accessibility_new
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-300 tracking-[0.2em] drop-shadow-sm">
              CHH RADIOLOGY
            </h1>
          </div>
        </div>
      </header>

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
