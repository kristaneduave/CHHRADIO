import React from 'react';
import { LiveMapPerfSample } from '../types';

interface LiveMapPerfPanelProps {
  samples: LiveMapPerfSample[];
}

const LiveMapPerfPanel: React.FC<LiveMapPerfPanelProps> = ({ samples }) => {
  if (!samples.length) return null;

  return (
    <div className="fixed right-3 bottom-[92px] z-[180] w-[320px] max-w-[90vw] rounded-xl border border-cyan-500/30 bg-[#06111d]/90 backdrop-blur-md shadow-2xl p-3 pointer-events-none">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold">Live Map Perf</p>
        <p className="text-[10px] text-slate-400">{samples.length} samples</p>
      </div>
      <div className="space-y-1.5">
        {samples.slice(-10).reverse().map((sample, index) => (
          <div key={`${sample.at}-${sample.label}-${index}`} className="rounded-md border border-white/10 bg-black/25 px-2 py-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-200 truncate">{sample.label}</p>
              <p className="text-[11px] text-cyan-300 font-mono">{sample.durationMs}ms</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(LiveMapPerfPanel);
