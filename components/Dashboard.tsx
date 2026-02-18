
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#050a10] pb-28 flex flex-col">
      {/* Header - Just the brand */}
      <header className="pt-14 pb-10 px-6 flex justify-center">
        <h1 className="text-[1.15rem] font-semibold text-slate-300 tracking-[0.3em] uppercase">
          CHH Radiology
        </h1>
      </header>

      {/* Grid */}
      <main className="flex-1 px-5 max-w-md mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="group relative flex flex-col items-center justify-center gap-5 rounded-2xl bg-[#111827] border border-[#1e293b] py-8 px-4 transition-all duration-300 active:scale-[0.97] hover:border-cyan-800/40"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Cyan glow behind the icon */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-20 h-20 rounded-full opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(6,182,212,0.55) 0%, rgba(6,182,212,0.15) 40%, transparent 70%)',
                }}
              />

              {/* Icon in a subtle container */}
              <div className="relative z-10 w-14 h-14 rounded-xl bg-[#0c1424] border border-cyan-900/30 flex items-center justify-center">
                <span className="material-icons text-cyan-400 text-[1.75rem]">
                  {action.icon}
                </span>
              </div>

              {/* Label */}
              <span className="relative z-10 text-[0.85rem] font-medium text-slate-300 tracking-wide text-center leading-tight">
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
