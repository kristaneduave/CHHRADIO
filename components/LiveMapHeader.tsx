import React from 'react';
import { LiveMapPerfSample } from '../types';

interface LiveMapHeaderProps {
  myLiveFloorName: string | null;
  hasAreaPresence: boolean;
  isLeavingArea: boolean;
  statusInput: string;
  statusPresets: string[];
  onLeaveArea: () => void;
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
  statusInput,
  statusPresets,
  onLeaveArea,
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
      <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-white/10 shadow-inner">
            <span className="material-icons text-emerald-400">computer</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-[0.2em] uppercase">Live Map</h2>
            {myLiveFloorName ? (
              <p className="mt-0.5 text-[11px] font-semibold text-cyan-300">You are in: {myLiveFloorName}</p>
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

      <div className="hidden xl:block absolute top-[5.5rem] right-[21rem] z-40 w-[300px] rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-3 space-y-2 shadow-2xl">
        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Status Bubble</p>
        <div className="flex flex-wrap gap-1.5">
          {statusPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => onApplyPreset(preset)}
              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-200"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={statusInput}
            onChange={(e) => onChangeStatusInput(e.target.value.slice(0, 20))}
            placeholder="Set status (max 20)"
            className="flex-1 bg-black/35 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={onSaveStatus}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-bold"
          >
            Set
          </button>
          <button
            onClick={onClearStatus}
            className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold"
          >
            Clear
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(LiveMapHeader);
