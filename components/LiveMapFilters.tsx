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
        <div className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 flex items-start justify-between gap-3">
          <p className="text-xs text-cyan-100">Tap map to set your area.</p>
          <button
            onClick={() => {
              onDismissCoachTip();
              if (typeof window !== 'undefined') window.localStorage.setItem(coachKey, '1');
            }}
            className="text-[11px] text-cyan-200 hover:text-white font-semibold"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={workstationQuery}
            onChange={(e) => onSetWorkstationQuery(e.target.value)}
            placeholder="Find workstation or occupant"
            className="flex-1 bg-black/35 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={() => onSetWorkstationQuery('')}
            className="px-2.5 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
          >
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'available', 'in_use', 'mine'] as WorkstationViewFilter[]).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => onSetWorkstationFilter(filterKey)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] uppercase tracking-wider ${workstationFilter === filterKey
                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
            >
              {filterKey === 'all' ? 'All' : filterKey === 'in_use' ? 'In Use' : filterKey === 'mine' ? 'Mine' : 'Available'}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Showing {filteredCount} of {totalCount} workstations
        </p>
      </div>
    </>
  );
};

export default React.memo(LiveMapFilters);
