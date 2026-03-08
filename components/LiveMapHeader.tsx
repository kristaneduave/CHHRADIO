import React from 'react';
import { LiveMapPerfSample } from '../types';

interface LiveMapHeaderProps {
  myLiveFloorName: string | null;
  hasAreaPresence: boolean;
  isLeavingArea: boolean;
  isModerator: boolean;
  staleFirstEnabled: boolean;
  moderationCounts: {
    active: number;
    stale: number;
    elsewhere: number;
  };
  statusInput: string;
  statusPresets: string[];
  onLeaveArea: () => void;
  onToggleStaleFirst: (value: boolean) => void;
  onOpenMobileStatus: () => void;
  onChangeStatusInput: (value: string) => void;
  onApplyPreset: (preset: string) => void;
  onSaveStatus: () => void;
  onClearStatus: () => void;
  onPerfSample?: (sample: LiveMapPerfSample) => void;
}

const LiveMapHeader: React.FC<LiveMapHeaderProps> = ({
  myLiveFloorName,
  hasAreaPresence,
  isLeavingArea,
  isModerator,
  staleFirstEnabled,
  moderationCounts,
  statusInput,
  statusPresets,
  onLeaveArea,
  onToggleStaleFirst,
  onOpenMobileStatus,
  onChangeStatusInput,
  onApplyPreset,
  onSaveStatus,
  onClearStatus,
  onPerfSample,
}) => {
  React.useEffect(() => {
    onPerfSample?.({
      label: 'LiveMapHeader:render',
      durationMs: 0,
      at: new Date().toISOString(),
    });
  });

  return (
    <>
      <div className="px-3 sm:px-6 py-2.5 sm:py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0a0f18]/60 backdrop-blur-2xl">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="material-icons text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">computer</span>
          </div>
          <div>
            <h2 className="text-base sm:text-[1.1rem] font-black text-white tracking-[0.2em] uppercase drop-shadow-md leading-tight">Live Map</h2>
            {myLiveFloorName ? (
              <p className="mt-0.5 text-[9px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-widest opacity-90 line-clamp-1">Sector: {myLiveFloorName}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasAreaPresence ? (
            <button
              onClick={onLeaveArea}
              disabled={isLeavingArea}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/25 disabled:opacity-60"
              title="Remove your pinned area presence"
            >
              {isLeavingArea ? 'Leaving...' : 'Leave Area'}
            </button>
          ) : null}
          <button
            onClick={onOpenMobileStatus}
            className="xl:hidden px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10"
          >
            Status
          </button>
        </div>
      </div>

      {isModerator ? (
        <div className="px-3 sm:px-6 py-2 border-b border-white/5 bg-black/40 shadow-inner flex overflow-x-auto hide-scrollbar touch-pan-x w-full">
          <div className="flex items-center gap-2 min-w-max">
            <label className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-200 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 uppercase tracking-wider cursor-pointer hover:bg-sky-500/20 transition-colors whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={staleFirstEnabled}
                onChange={(event) => onToggleStaleFirst(event.target.checked)}
                className="accent-sky-400 w-3 h-3 sm:w-auto sm:h-auto"
              />
              Stale First
            </label>
            <div className="h-4 w-px bg-white/10 mx-0.5 sm:mx-1 shrink-0" />
            <span className="text-[9px] sm:text-[10px] whitespace-nowrap font-bold tracking-widest uppercase text-slate-300 rounded-lg border border-white/10 bg-white/5 px-2 sm:px-2.5 py-1 shrink-0">
              Active: <span className="text-white ml-0.5">{moderationCounts.active}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] whitespace-nowrap font-bold tracking-widest uppercase text-amber-300 rounded-lg border border-amber-500/30 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.1)] px-2 sm:px-2.5 py-1 shrink-0">
              Stale: <span className="text-white ml-0.5">{moderationCounts.stale}</span>
            </span>
            <span className="text-[9px] sm:text-[10px] whitespace-nowrap font-bold tracking-widest uppercase text-slate-400 rounded-lg border border-white/5 bg-white/[0.02] px-2 sm:px-2.5 py-1 shrink-0">
              Other: <span className="text-slate-300 ml-0.5">{moderationCounts.elsewhere}</span>
            </span>
          </div>
        </div>
      ) : null}

      <div className="hidden xl:block absolute top-[5.5rem] right-[21rem] z-40 w-[320px] rounded-2xl border border-white/10 bg-[#0a0f18]/90 backdrop-blur-xl p-4 space-y-3 shadow-[0_0_40px_-10px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Broadcast Status</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => onApplyPreset(preset)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 hover:border-sky-500/30 border border-white/10 text-[10px] font-bold tracking-wide uppercase text-slate-300 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1 border-t border-white/5 mt-2">
          <input
            value={statusInput}
            onChange={(e) => onChangeStatusInput(e.target.value.slice(0, 20))}
            placeholder="Custom status (max 20)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-950/20 transition-all font-medium placeholder:text-slate-500"
          />
          <button
            onClick={onSaveStatus}
            className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest transition-colors shadow-[0_0_10px_rgba(34,211,238,0.1)] hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
          >
            Set
          </button>
          <button
            onClick={onClearStatus}
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(LiveMapHeader);
