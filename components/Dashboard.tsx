
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#050B14]">
      {/* Top Minimalist Header */}
      <header className="relative flex flex-col items-center justify-center pt-8 pb-6 px-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-[0.2em] drop-shadow-sm border-b border-white/10 pb-2 px-8">
          CHH RADIOLOGY
        </h1>
      </header>

      {/* Centered Quick Actions (Thumb-Friendly Mobile) */}
      <section className="px-6 flex-1 flex flex-col items-center max-w-sm mx-auto w-full pb-24 justify-center">
        <div className="w-full space-y-4">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="w-full glass-card-enhanced rounded-2xl p-4 flex items-center gap-5 group hover:bg-white/5 transition-all text-left active:scale-[0.98] border border-white/5 hover:border-white/10 relative overflow-hidden shadow-lg"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Subtle gradient background based on action color */}
              <div className={`absolute inset-0 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

              <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${action.color} group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-inner`}>
                <span className="material-icons text-2xl">{action.icon}</span>
              </div>
              <div className="flex-1 relative z-10 min-w-0">
                <span className={`block text-base font-bold text-slate-200 group-hover:text-white transition-colors truncate mb-0.5`}>{action.label}</span>
                <span className="block text-xs text-slate-500 font-medium group-hover:text-slate-400 transition-colors truncate">{action.subtitle}</span>
              </div>
              <span className={`material-icons ${action.color} opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-xl relative z-10`}>arrow_forward_ios</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
