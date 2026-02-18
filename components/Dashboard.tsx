
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
      {/* Minimal Branding Header */}
      <header className="flex justify-between items-center px-6 pt-12 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/10 flex items-center justify-center border border-primary/20">
            <span className="material-icons text-primary text-lg">radiology</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">CHH Radiology</h1>
            <p className="text-[9px] text-primary/60 font-semibold uppercase tracking-[0.15em] -mt-0.5">Department Hub</p>
          </div>
        </div>
        <button
          onClick={() => setShowNotifications(true)}
          className="w-9 h-9 rounded-full glass-card-enhanced flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all relative"
        >
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#050B14]"></span>
          <span className="material-icons text-lg">notifications</span>
        </button>
      </header>

      {/* Today at a Glance */}
      <section className="px-6 mb-6">
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">Today at a Glance</h2>
        <div className="space-y-3">
          {/* Next Event Card */}
          {nextEvent && (
            <div
              onClick={() => onNavigate('calendar')}
              className="glass-card-enhanced p-4 rounded-xl border-l-4 border-l-primary flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">NEXT EVENT</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(nextEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{nextEvent.title}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{nextEvent.location || 'Main Auditorium'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <span className="material-icons text-slate-400 text-sm group-hover:text-primary">event</span>
              </div>
            </div>
          )}

          {/* Latest Announcement Card */}
          {latestAnnouncement && (
            <div
              onClick={() => onNavigate('announcements')}
              className="glass-card-enhanced p-4 rounded-xl border-l-4 border-l-rose-500 flex items-start gap-4 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">ANNOUNCEMENT</span>
                  <span className="text-[10px] text-slate-400 font-medium">{latestAnnouncement.date}</span>
                </div>
                <h3 className="text-sm font-bold text-white truncate group-hover:text-rose-400 transition-colors">{latestAnnouncement.title}</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{latestAnnouncement.summary}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-500/20 transition-colors">
                <span className="material-icons text-slate-400 text-sm group-hover:text-rose-500">campaign</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions (List View) */}
      <section className="px-6 pb-20">
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">Quick Actions</h2>
        <div className="space-y-2.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="w-full glass-card-enhanced rounded-xl p-3.5 flex items-center gap-4 group hover:border-primary/30 hover:bg-white/5 transition-all text-left active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/20 transition-colors shadow-inner">
                <span className="material-icons text-xl">{action.icon}</span>
              </div>
              <div className="flex-1">
                <span className="block text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{action.label}</span>
                <span className="block text-[10px] text-slate-500 font-medium group-hover:text-slate-400 transition-colors">{action.subtitle}</span>
              </div>
              <span className="material-icons text-slate-600 group-hover:text-primary/50 text-xl transition-colors">chevron_right</span>
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
