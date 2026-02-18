
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

// Accent map based on All Specialties aesthetic
const BUTTON_STYLES: Record<string, { bg: string; text: string; shadow: string }> = {
  'Announcements': { bg: 'bg-purple-500/10', text: 'text-purple-400', shadow: 'shadow-purple-500/10' },
  'Calendar': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', shadow: 'shadow-emerald-500/10' },
  'Database': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', shadow: 'shadow-cyan-500/10' },
  'Upload Case': { bg: 'bg-blue-500/10', text: 'text-blue-400', shadow: 'shadow-blue-500/10' },
  'Quiz': { bg: 'bg-pink-500/10', text: 'text-pink-400', shadow: 'shadow-pink-500/10' },
  "Resident's Corner": { bg: 'bg-amber-500/10', text: 'text-amber-400', shadow: 'shadow-amber-500/10' },
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

      {/* Grid */}
      <main className="flex-1 px-5 max-w-md mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action, index) => {
            const style = BUTTON_STYLES[action.label] || { bg: 'bg-slate-700/30', text: 'text-slate-300', shadow: '' };

            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.target)}
                className="group relative flex flex-col items-center justify-center gap-4 rounded-[1.25rem] bg-[#0f1621] border border-[#1a2332] py-8 px-4 transition-all duration-300 hover:border-slate-600/30 active:scale-[0.98] hover:bg-[#131b29]"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Colored Icon Circle */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${style.bg} ${style.shadow} shadow-lg ring-1 ring-white/5`}>
                  <span className={`material-icons text-[2rem] ${style.text}`}>
                    {action.icon}
                  </span>
                </div>

                {/* Label */}
                <span className="text-[0.9rem] font-semibold text-slate-300 tracking-wide text-center">
                  {action.label}
                </span>

                {/* Subtle Hover Glow BG (Optional, keeps it clean) */}
                <div className={`absolute inset-0 rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none radial-glow`} />
              </button>
            );
          })}
        </div>
      </main>

      <style>{`
        .radial-glow {
          background: radial-gradient(circle at center, rgba(255,255,255,0.03) 0%, transparent 70%);
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
