import React from 'react';

interface AppBootScreenProps {
  progress: number;
  statusLabel: string;
}

const AppBootScreen: React.FC<AppBootScreenProps> = ({ progress, statusLabel }) => {
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="min-h-screen bg-app text-text-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-black text-white uppercase tracking-[0.1em]">
              RADCORE
            </h1>
            <p className="mt-3 text-[11px] sm:text-[13px] font-bold text-sky-400 uppercase tracking-[0.1em] opacity-90">
              CHH Radiology Residency Portal
            </p>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-white/8 bg-black/20 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{statusLabel}</p>
              <span className="text-xs font-bold text-slate-400">{normalizedProgress}%</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.85),rgba(59,130,246,0.9))] transition-[width] duration-300 ease-out"
                style={{ width: `${normalizedProgress}%` }}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              Entering app when ready or after 5 seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppBootScreen;
