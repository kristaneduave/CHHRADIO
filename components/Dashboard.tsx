
import React, { useState } from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

import NotificationCenter from './NotificationCenter';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [showNotifications, setShowNotifications] = useState(false);

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

      {/* Quick Actions */}
      <section className="px-6">
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="glass-card-enhanced rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2.5 group hover:border-primary/30 transition-all active:scale-[0.98]"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <span className="material-icons text-xl">{action.icon}</span>
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white">{action.label}</span>
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
