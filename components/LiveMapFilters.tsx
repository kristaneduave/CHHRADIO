import React from 'react';
import { LiveMapPerfSample } from '../types';

type WorkstationViewFilter = 'all' | 'available' | 'in_use' | 'mine';

interface LiveMapFiltersProps {
  showCoachTip: boolean;
  coachKey: string;
  workstationQuery: string;
  workstationFilter: WorkstationViewFilter;
  filteredCount: number;
  totalCount: number;
  onDismissCoachTip: () => void;
  onSetWorkstationQuery: (value: string) => void;
  onSetWorkstationFilter: (filter: WorkstationViewFilter) => void;
  onPerfSample?: (sample: LiveMapPerfSample) => void;
}

const LiveMapFilters: React.FC<LiveMapFiltersProps> = ({
  showCoachTip,
  coachKey,
  workstationQuery,
  workstationFilter,
  filteredCount,
  totalCount,
  onDismissCoachTip,
  onSetWorkstationQuery,
  onSetWorkstationFilter,
  onPerfSample,
}) => {
  React.useEffect(() => {
    onPerfSample?.({
      label: 'LiveMapFilters:render',
      durationMs: 0,
      at: new Date().toISOString(),
    });
  });

  return (
    <>
      {showCoachTip ? (
        <div className="mb-4 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-3 flex items-start justify-between gap-3 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          <p className="text-[11px] font-black text-cyan-100 uppercase tracking-widest drop-shadow-md">Tap map to set your area.</p>
          <button
            onClick={() => {
              onDismissCoachTip();
              if (typeof window !== 'undefined') window.localStorage.setItem(coachKey, '1');
            }}
            className="text-[10px] uppercase font-bold text-cyan-200 hover:text-white tracking-widest transition-colors"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <input
            value={workstationQuery}
            onChange={(e) => onSetWorkstationQuery(e.target.value)}
            placeholder="FIND STATION OR OCCUPANT"
            className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500/50 focus:bg-cyan-950/20 transition-all placeholder:text-slate-500 placeholder:uppercase placeholder:tracking-widest"
          />
          <button
            onClick={() => onSetWorkstationQuery('')}
            className="px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'available', 'in_use', 'mine'] as WorkstationViewFilter[]).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => onSetWorkstationFilter(filterKey)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${workstationFilter === filterKey
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-sky-500/30'
                }`}
            >
              {filterKey === 'all' ? 'All' : filterKey === 'in_use' ? 'In Use' : filterKey === 'mine' ? 'Mine' : 'Available'}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
          Tracking {filteredCount} / {totalCount} assets
        </p>
      </div>
    </>
  );
};

export default React.memo(LiveMapFilters);
