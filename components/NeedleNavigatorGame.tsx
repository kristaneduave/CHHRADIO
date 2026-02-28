import React, { useMemo } from 'react';
import { useNeedleNavigatorSession } from '../hooks/useNeedleNavigatorSession';
import NeedleNavigatorDebrief from './NeedleNavigatorDebrief';
import { getDifficultyProfile } from '../utils/needlePhysics';

interface NeedleNavigatorGameProps {
  userId: string | null;
  onClose: () => void;
}

const formatSeconds = (ms: number): string => `${Math.max(0, Math.ceil(ms / 1000))}s`;

const NeedleNavigatorGame: React.FC<NeedleNavigatorGameProps> = ({ userId, onClose }) => {
  const game = useNeedleNavigatorSession(userId);

  const remainingMs = game.scenario.time_limit_sec * 1000 - game.elapsedMs;
  const profile = getDifficultyProfile(game.scenario.difficulty);
  const target = game.targetState ?? {
    x: game.scenario.target_config.x,
    y: game.scenario.target_config.baseY,
    radiusX: game.scenario.target_config.radiusX,
    radiusY: game.scenario.target_config.radiusY,
  };

  const scale = useMemo(() => {
    const width = game.scenario.field_width;
    const height = game.scenario.field_height;
    return { width, height };
  }, [game.scenario.field_height, game.scenario.field_width]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 text-white overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 pb-14">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">Needle Navigator</h2>
            <p className="text-xs text-slate-400">{game.scenario.title} · {profile.label}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10">
            Close
          </button>
        </div>

        {game.loading ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-slate-300">Loading scenarios…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900/70" style={{ aspectRatio: `${scale.width} / ${scale.height}` }}>
                {game.scenario.risk_config.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="absolute rounded-full border border-rose-500/40 bg-rose-500/15"
                    style={{
                      left: `${((zone.x - zone.radius) / scale.width) * 100}%`,
                      top: `${((zone.y - zone.radius) / scale.height) * 100}%`,
                      width: `${(zone.radius * 2 / scale.width) * 100}%`,
                      height: `${(zone.radius * 2 / scale.height) * 100}%`,
                    }}
                  />
                ))}

                <div
                  className="absolute rounded-full border border-cyan-300 bg-cyan-400/25"
                  style={{
                    left: `${((target.x - target.radiusX) / scale.width) * 100}%`,
                    top: `${((target.y - target.radiusY) / scale.height) * 100}%`,
                    width: `${(target.radiusX * 2 / scale.width) * 100}%`,
                    height: `${(target.radiusY * 2 / scale.height) * 100}%`,
                  }}
                />

                <svg className="absolute inset-0 h-full w-full">
                  <line
                    x1={(game.scenario.needle_entry_x / scale.width) * 100 + '%'}
                    y1={(game.scenario.needle_entry_y / scale.height) * 100 + '%'}
                    x2={(game.tip.x / scale.width) * 100 + '%'}
                    y2={(game.tip.y / scale.height) * 100 + '%'}
                    stroke="#f8fafc"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  <circle
                    cx={(game.tip.x / scale.width) * 100 + '%'}
                    cy={(game.tip.y / scale.height) * 100 + '%'}
                    r="4"
                    fill={game.evaluation?.insideTarget ? '#22d3ee' : game.evaluation?.insideRisk ? '#fb7185' : '#f8fafc'}
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              {game.phase === 'brief' && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <p className="text-xs text-cyan-300 uppercase tracking-wider">{game.scenario.anatomy} · {profile.label}</p>
                  <p className="text-sm mt-2 text-slate-100">Target the moving lesion while avoiding critical structures.</p>
                  <ul className="mt-3 text-xs text-slate-300 list-disc list-inside space-y-1">
                    <li>Adjust angle and depth slowly</li>
                    <li>Commit only after stable target lock (400ms+)</li>
                    <li>Avoid no-go zones to preserve safety score</li>
                  </ul>
                  <button onClick={game.startRun} className="mt-4 w-full rounded-lg bg-cyan-500 text-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-cyan-400">
                    Start Simulation
                  </button>
                </div>
              )}

              {game.phase === 'running' && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Time Left</span>
                    <span className="font-semibold text-white">{formatSeconds(remainingMs)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, (remainingMs / (game.scenario.time_limit_sec * 1000)) * 100))}%` }}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Angle ({game.angleDeg}°)</label>
                    <input
                      type="range"
                      min={-70}
                      max={70}
                      step={profile.angleStep}
                      value={game.angleDeg}
                      onChange={(e) => game.setAngle(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Depth ({Math.round(game.depthPx)} px)</label>
                    <input
                      type="range"
                      min={0}
                      max={game.scenario.max_depth}
                      step={profile.controlStep}
                      value={game.depthPx}
                      onChange={(e) => game.setDepth(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] text-slate-300">
                    <p>Target Distance: {Math.round(game.evaluation?.tipDistanceToTargetCenter ?? 0)} px</p>
                    <p className={game.evaluation?.insideRisk ? 'text-rose-300' : 'text-amber-200'}>
                      Risk: {game.evaluation?.insideRisk ? 'In no-go zone' : game.evaluation?.nearRisk ? 'Near risk zone' : 'Clear'}
                    </p>
                    <p>Stable lock: {Math.round(game.stableMs)} ms</p>
                  </div>

                  <button
                    onClick={game.commitPuncture}
                    className="w-full rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/25"
                  >
                    Commit Puncture
                  </button>
                </div>
              )}

              {game.phase === 'debrief' && (
                <NeedleNavigatorDebrief
                  scenario={game.scenario}
                  result={game.lastResult}
                  submitting={game.submitting}
                  onRetry={game.retryScenario}
                  onNext={game.nextScenario}
                  onClose={onClose}
                />
              )}

              {game.error && (
                <p className="text-xs text-rose-300">{game.error}</p>
              )}

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">7-Day Leaderboard</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  {game.leaderboard.length ? game.leaderboard.slice(0, 5).map((row, idx) => (
                    <div key={row.user_id} className="flex items-center justify-between text-slate-200">
                      <span>{idx + 1}. {row.display_name}</span>
                      <span>{Math.round(row.avg_score)}</span>
                    </div>
                  )) : <p className="text-slate-500">No leaderboard data yet.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Recent Runs</p>
                <div className="mt-2 space-y-1.5 text-xs">
                  {game.history.length ? game.history.slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center justify-between text-slate-200">
                      <span>{Math.round(run.duration_ms / 1000)}s · {run.competency_band}</span>
                      <span>{run.score}</span>
                    </div>
                  )) : <p className="text-slate-500">No run history yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NeedleNavigatorGame;
