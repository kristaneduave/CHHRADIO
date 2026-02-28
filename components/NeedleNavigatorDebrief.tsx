import React from 'react';
import { NeedleScenario, NeedleSessionResult } from '../types';

interface NeedleNavigatorDebriefProps {
  scenario: NeedleScenario;
  result: NeedleSessionResult | null;
  submitting: boolean;
  onRetry: () => void;
  onNext: () => void;
  onClose: () => void;
}

const metricClass = 'rounded-lg border border-white/10 bg-black/20 px-3 py-2';

const NeedleNavigatorDebrief: React.FC<NeedleNavigatorDebriefProps> = ({
  scenario,
  result,
  submitting,
  onRetry,
  onNext,
  onClose,
}) => {
  if (!result) {
    return null;
  }

  const { metrics, breakdown } = result;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">{scenario.title}</p>
        <div className="flex items-end justify-between mt-2">
          <div>
            <p className="text-3xl font-bold text-white">{result.score}</p>
            <p className="text-xs text-cyan-300">{result.competency_band}</p>
          </div>
          <p className="text-xs text-slate-400">{Math.round(metrics.elapsed_ms / 1000)}s</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={metricClass}><p className="text-[10px] text-slate-400">Accuracy</p><p className="text-lg font-semibold text-white">{breakdown.accuracy}</p></div>
        <div className={metricClass}><p className="text-[10px] text-slate-400">Trajectory</p><p className="text-lg font-semibold text-white">{breakdown.trajectory}</p></div>
        <div className={metricClass}><p className="text-[10px] text-slate-400">Safety</p><p className="text-lg font-semibold text-white">{breakdown.safety}</p></div>
        <div className={metricClass}><p className="text-[10px] text-slate-400">Efficiency</p><p className="text-lg font-semibold text-white">{breakdown.efficiency}</p></div>
      </div>

      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-slate-200">
        <p>Attempts: {metrics.puncture_attempts}</p>
        <p>Redirects: {metrics.redirects}</p>
        <p>Risk Zone Hits: {metrics.risk_hits}</p>
        <p>Risk Exposure: {Math.round(metrics.risk_exposure_ms)} ms</p>
      </div>

      {submitting && <p className="text-xs text-amber-300">Saving run…</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={onRetry} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10">Retry</button>
        <button onClick={onNext} className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/25">Next Scenario</button>
        <button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">Done</button>
      </div>
    </div>
  );
};

export default NeedleNavigatorDebrief;
