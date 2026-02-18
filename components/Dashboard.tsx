
import React from 'react';
import { QUICK_ACTIONS } from '../constants';
import { Screen } from '../types';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#020408] pb-24 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Minimalist Header */}
      <header className="pt-14 pb-8 px-6 flex justify-center animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-xl font-bold text-slate-200 tracking-[0.25em] uppercase opacity-90">
          CHH Radiology
        </h1>
      </header>

      {/* Main Content - Spotlight Grid */}
      <main className="flex-1 px-5 flex flex-col justify-center pb-20 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action, index) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.target)}
              className="group relative aspect-[1.1/1] rounded-[2rem] bg-[#0F172A] border border-white/5 overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl hover:shadow-cyan-900/20"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              {/* Spotlight Glow Effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-out"
                style={{
                  background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15) 0%, rgba(15, 23, 42, 0) 70%)'
                }}
              />

              {/* Idle Glow (Subtle) */}
              <div
                className="absolute inset-0 opacity-40 group-hover:opacity-0 transition-opacity duration-700"
                style={{
                  background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.05) 0%, rgba(15, 23, 42, 0) 60%)'
                }}
              />

              <div className="relative z-10 flex flex-col items-center justify-center h-full gap-5">
                {/* Icon Container - Floating */}
                <div className="transform group-hover:-translate-y-1 transition-transform duration-500 ease-out">
                  <span className={`material-icons text-[2.75rem] ${action.color} drop-shadow-[0_0_15px_rgba(34,211,238,0.3)] opacity-90 group-hover:opacity-100 transition-all`}>
                    {action.icon}
                  </span>
                </div>

                {/* Visual Anchor / Line */}
                {/* <div className="w-8 h-0.5 bg-slate-800 rounded-full group-hover:bg-cyan-500/30 transition-colors duration-500" /> */}

                {/* Label */}
                <span className="text-[0.9rem] font-medium text-slate-400 group-hover:text-white transition-colors duration-300 tracking-wide text-center">
                  {action.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
