
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
      <header className="relative flex flex-col items-center justify-center pt-16 pb-12 px-6">
        <button
          onClick={() => setShowNotifications(true)}
          className="absolute top-6 right-6 w-10 h-10 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050B14]"></span>
          <span className="material-icons text-xl">notifications</span>
        </button>

        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-700">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] border border-white/20">
            <span className="material-icons text-white text-4xl drop-shadow-md">radiology</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-300 tracking-[0.2em] drop-shadow-sm">
              CHH RADIOLOGY
            </h1>
          </div>
        </div>
      </header>

      {/* Centered Quick Actions */}
      <section className="px-6 flex-1 flex flex-col items-center max-w-md mx-auto w-full pb-10">
        <div className="w-full space-y-3">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="w-full glass-card-enhanced rounded-xl p-4 flex items-center gap-4 group hover:bg-white/5 transition-all text-left active:scale-[0.98] border border-white/5 hover:border-white/10 relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Subtle gradient background based on action color */}
              <div className={`absolute inset-0 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

              <div className={`w-12 h-12 rounded-full bg-white/5 flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform duration-300 relative z-10`}>
                <span className="material-icons text-2xl">{action.icon}</span>
              </div>
              <div className="flex-1 relative z-10">
                <span className={`block text-sm font-bold text-slate-200 group-hover:text-white transition-colors`}>{action.label}</span>
                <span className="block text-[11px] text-slate-500 font-medium group-hover:text-slate-400 transition-colors">{action.subtitle}</span>
              </div>
              <span className={`material-icons ${action.color} opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-xl relative z-10`}>arrow_forward_ios</span>
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
