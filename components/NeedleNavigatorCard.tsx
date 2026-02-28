import React from 'react';
import { NeedleUserStats } from '../types';

interface NeedleNavigatorCardProps {
  onOpen: () => void;
  stats: NeedleUserStats | null;
}

const NeedleNavigatorCard: React.FC<NeedleNavigatorCardProps> = ({ onOpen, stats }) => {
  return (
    <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 relative overflow-hidden">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-300">Needle Navigator</h2>
          <p className="text-xs text-slate-300 mt-1">
            Ultrasound-guided targeting simulation with motion, risk zones, and scoring debrief.
          </p>
          <div className="mt-3 text-[11px] text-slate-300 flex flex-wrap gap-3">
            <span>Runs: <strong className="text-white">{stats?.runs_count ?? 0}</strong></span>
            <span>Avg: <strong className="text-white">{Math.round(stats?.avg_score ?? 0)}</strong></span>
            <span>Best: <strong className="text-white">{Math.round(stats?.best_score ?? 0)}</strong></span>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 rounded-xl bg-cyan-500 text-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-cyan-400 transition-colors"
        >
          Launch
        </button>
      </div>
    </section>
  );
};

export default NeedleNavigatorCard;
