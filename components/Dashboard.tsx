
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#050B14] pb-24 flex flex-col">
      {/* Minimalist Header */}
      <header className="pt-12 pb-6 px-6 flex justify-center">
        <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-[0.2em]">
          CHH RADIOLOGY
        </h1>
      </header>

      {/* Main Content - Centered Grid */}
      <main className="flex-1 px-6 flex flex-col justify-center pb-20">
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="glass-card-enhanced group aspect-square rounded-3xl border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-2xl"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Center Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/0 group-hover:via-cyan-500/5 transition-all duration-500"></div>
              <div className="absolute w-20 h-20 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

              <div className={`w-14 h-14 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform duration-300 shadow-inner relative z-10`}>
                <span className="material-icons text-3xl">{action.icon}</span>
              </div>

              <span className="relative z-10 text-sm font-bold text-slate-300 group-hover:text-white transition-colors tracking-wide text-center px-2">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
