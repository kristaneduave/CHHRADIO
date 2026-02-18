
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

// Each button gets a unique accent color for its icon circle
const BUTTON_ACCENTS: Record<string, { bg: string; text: string; glow: string }> = {
  'Announcements': { bg: 'bg-purple-500/15', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  'Calendar': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  'Database': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  'Upload Case': { bg: 'bg-blue-500/15', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  'Quiz': { bg: 'bg-pink-500/15', text: 'text-pink-400', glow: 'shadow-pink-500/20' },
  "Resident's Corner": { bg: 'bg-amber-500/15', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#050a10] pb-28 flex flex-col">
      {/* Header */}
      <header className="pt-14 pb-10 px-6 flex justify-center">
        <h1 className="text-[1.1rem] font-semibold text-slate-300 tracking-[0.3em] uppercase">
          CHH Radiology
        </h1>
      </header>

      {/* Action Cards */}
      <main className="flex-1 px-5 max-w-md mx-auto w-full flex flex-col gap-3">
        {QUICK_ACTIONS.map((action, index) => {
          const accent = BUTTON_ACCENTS[action.label] || { bg: 'bg-cyan-500/15', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' };
          return (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#0d1520] border border-[#1a2535] hover:border-slate-600/40 transition-all duration-300 active:scale-[0.98] hover:bg-[#111d2e]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Colored Icon Circle */}
              <div className={`shrink-0 w-12 h-12 rounded-full ${accent.bg} flex items-center justify-center shadow-lg ${accent.glow}`}>
                <span className={`material-icons text-[1.4rem] ${accent.text}`}>
                  {action.icon}
                </span>
              </div>

              {/* Label */}
              <span className="text-[0.95rem] font-semibold text-slate-200 tracking-wide">
                {action.label}
              </span>

              {/* Right Arrow */}
              <span className="material-icons text-slate-600 text-lg ml-auto group-hover:text-slate-400 transition-colors">
                chevron_right
              </span>
            </button>
          );
        })}
      </main>
    </div>
  );
};

export default Dashboard;
