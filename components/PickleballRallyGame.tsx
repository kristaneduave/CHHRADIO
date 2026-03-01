import React, { useMemo, useRef } from 'react';
import { usePickleballRallySession } from '../hooks/usePickleballRallySession';
import { PickleballDifficulty } from '../types';

interface PickleballRallyGameProps {
  userId: string | null;
  onClose: () => void;
}

const formatSeconds = (ms: number) => `${Math.max(0, Math.ceil(ms / 1000))}s`;

const difficultyLabel: Record<PickleballDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const PickleballRallyGame: React.FC<PickleballRallyGameProps> = ({ userId, onClose }) => {
  const game = usePickleballRallySession(userId);
  const courtRef = useRef<HTMLDivElement | null>(null);

  const paddleStyle = useMemo(() => {
    const width = game.difficulty === 'beginner' ? 20 : game.difficulty === 'advanced' ? 15 : 17.5;
    return {
      left: `${game.physics.paddleX * 100}%`,
      width: `${width}%`,
      transform: 'translateX(-50%)',
    };
  }, [game.difficulty, game.physics.paddleX]);

  const ballStyle = useMemo(
    () => ({
      left: `${game.physics.ballX * 100}%`,
      top: `${game.physics.ballY * 100}%`,
      transform: 'translate(-50%, -50%)',
    }),
    [game.physics.ballX, game.physics.ballY],
  );

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!courtRef.current || game.phase !== 'running') return;
    const rect = courtRef.current.getBoundingClientRect();
    const next = (event.clientX - rect.left) / rect.width;
    game.setPaddleX(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 text-white overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 pb-14">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">Pickleball Rally</h2>
            <p className="text-xs text-slate-400">Reflex mode · Solo</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <div
              ref={courtRef}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerMove}
              className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-slate-900/70 touch-none select-none"
              style={{ aspectRatio: '9 / 16' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,0.12),transparent_50%)]" />
              <div className="absolute left-0 right-0 top-[10%] h-px bg-white/15" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
              <div className="absolute left-0 right-0 bottom-[8%] h-px bg-white/15" />
              <div className="absolute h-4 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.5)] bottom-[6%]" style={paddleStyle} />
              <div className="absolute h-4 w-4 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.6)]" style={ballStyle} />
            </div>
          </div>

          <div className="space-y-3">
            {game.phase === 'brief' && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <p className="text-xs text-cyan-300 uppercase tracking-wider">Choose Difficulty</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as PickleballDifficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => game.setDifficulty(d)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-bold border transition ${
                        game.difficulty === d
                          ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-100'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {difficultyLabel[d]}
                    </button>
                  ))}
                </div>
                <ul className="mt-3 text-xs text-slate-300 list-disc list-inside space-y-1">
                  <li>Drag horizontally to return the ball.</li>
                  <li>Each return scores points and builds combo.</li>
                  <li>Sweet center hits grant bonus points.</li>
                </ul>
                {!game.canSave ? (
                  <p className="mt-3 text-[11px] text-amber-300">Sign in to save your score.</p>
                ) : null}
                <button
                  onClick={game.startRun}
                  className="mt-4 w-full rounded-lg bg-cyan-500 text-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-cyan-400"
                >
                  Start Rally
                </button>
              </div>
            )}

            {game.phase === 'running' && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Score</p>
                    <p className="text-white font-bold">{game.score}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Rally</p>
                    <p className="text-white font-bold">{game.rallyCount}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Combo</p>
                    <p className="text-white font-bold">x{Math.max(1, game.combo)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Time</p>
                    <p className="text-white font-bold">{formatSeconds(game.elapsedMs)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Move finger anywhere in court to position paddle.</p>
              </div>
            )}

            {game.phase === 'debrief' && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Run Debrief</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Final Score</p>
                    <p className="text-white font-bold">{game.lastResult?.score ?? game.score}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Best Delta</p>
                    <p className={`font-bold ${game.scoreDelta >= 0 ? 'text-emerald-300' : 'text-slate-300'}`}>
                      {game.scoreDelta >= 0 ? '+' : ''}
                      {game.scoreDelta}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Rally</p>
                    <p className="text-white font-bold">{game.lastResult?.metrics.rally_count ?? game.rallyCount}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                    <p className="text-slate-400">Max Combo</p>
                    <p className="text-white font-bold">{game.lastResult?.metrics.max_combo ?? game.maxCombo}</p>
                  </div>
                </div>
                {game.error ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
                    {game.error}
                    <button
                      onClick={game.retrySave}
                      disabled={game.submitting}
                      className="ml-2 underline disabled:opacity-60"
                    >
                      Retry save
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    onClick={game.playAgain}
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-400"
                  >
                    Close
                  </button>
                </div>
              </div>
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
                    <span>{difficultyLabel[run.difficulty]} · {Math.round(run.metrics.duration_ms / 1000)}s</span>
                    <span>{run.score}</span>
                  </div>
                )) : <p className="text-slate-500">No run history yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PickleballRallyGame;
