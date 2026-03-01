import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PickleballDifficulty,
  PickleballLeaderboardRow,
  PickleballRunMetrics,
  PickleballRunResult,
  PickleballUserStats,
} from '../types';
import {
  getPickleballHistory,
  getPickleballLeaderboard,
  getPickleballUserStats,
  submitPickleballRun,
} from '../services/pickleballRallyService';

type SessionPhase = 'brief' | 'running' | 'debrief';

type PhysicsState = {
  ballX: number;
  ballY: number;
  velX: number;
  velY: number;
  paddleX: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const difficultyProfile = (difficulty: PickleballDifficulty) => {
  if (difficulty === 'beginner') {
    return { speed: 0.32, paddleWidth: 0.2, sweetSpotRatio: 0.45, rampEveryHits: 7, rampScale: 1.04 };
  }
  if (difficulty === 'advanced') {
    return { speed: 0.44, paddleWidth: 0.15, sweetSpotRatio: 0.3, rampEveryHits: 4, rampScale: 1.06 };
  }
  return { speed: 0.38, paddleWidth: 0.175, sweetSpotRatio: 0.36, rampEveryHits: 5, rampScale: 1.05 };
};

const initialPhysics = (difficulty: PickleballDifficulty): PhysicsState => {
  const profile = difficultyProfile(difficulty);
  return {
    ballX: 0.5,
    ballY: 0.2,
    velX: profile.speed * 0.55,
    velY: profile.speed,
    paddleX: 0.5,
  };
};

export const usePickleballRallySession = (userId: string | null) => {
  const [phase, setPhase] = useState<SessionPhase>('brief');
  const [difficulty, setDifficulty] = useState<PickleballDifficulty>('intermediate');
  const [physics, setPhysics] = useState<PhysicsState>(() => initialPhysics('intermediate'));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [score, setScore] = useState(0);
  const [rallyCount, setRallyCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [sweetHits, setSweetHits] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PickleballRunResult | null>(null);
  const [history, setHistory] = useState<PickleballRunResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<PickleballLeaderboardRow[]>([]);
  const [userStats, setUserStats] = useState<PickleballUserStats | null>(null);
  const [canSave, setCanSave] = useState(Boolean(userId));

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const submitPayloadRef = useRef<{
    startedAt: string;
    durationMs: number;
    score: number;
    difficulty: PickleballDifficulty;
    metrics: PickleballRunMetrics;
  } | null>(null);

  useEffect(() => setCanSave(Boolean(userId)), [userId]);

  const refreshStats = useCallback(async () => {
    if (!userId) {
      setHistory([]);
      setLeaderboard([]);
      setUserStats(null);
      return;
    }
    const [nextHistory, nextLeaderboard, nextStats] = await Promise.all([
      getPickleballHistory(userId, 5),
      getPickleballLeaderboard('7d'),
      getPickleballUserStats(userId),
    ]);
    setHistory(nextHistory);
    setLeaderboard(nextLeaderboard);
    setUserStats(nextStats);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    refreshStats()
      .catch((loadError: any) => setError(loadError?.message || 'Failed to load pickleball stats'))
      .finally(() => setLoading(false));
  }, [refreshStats]);

  const resetRun = useCallback((nextDifficulty: PickleballDifficulty) => {
    setPhysics(initialPhysics(nextDifficulty));
    setElapsedMs(0);
    setScore(0);
    setRallyCount(0);
    setCombo(0);
    setMaxCombo(0);
    setSweetHits(0);
    setMissCount(0);
    setError(null);
    startedAtRef.current = null;
    submitPayloadRef.current = null;
    lastFrameRef.current = null;
  }, []);

  const finishRun = useCallback(async () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setPhase('debrief');

    const startedAt = startedAtRef.current || new Date().toISOString();
    const metrics: PickleballRunMetrics = {
      duration_ms: Math.max(1, Math.round(elapsedMs)),
      rally_count: rallyCount,
      max_combo: maxCombo,
      miss_count: Math.max(1, missCount),
      sweet_hits: sweetHits,
    };
    const localResult: PickleballRunResult = {
      id: `local-${Date.now()}`,
      user_id: userId,
      score: Math.max(0, Math.round(score)),
      difficulty,
      metrics,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
    setLastResult(localResult);

    if (!userId || !canSave) return;

    setSubmitting(true);
    try {
      const persisted = await submitPickleballRun({
        startedAt,
        durationMs: metrics.duration_ms,
        score: localResult.score,
        difficulty,
        metrics,
      });
      setLastResult(persisted);
      await refreshStats();
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to save run');
      submitPayloadRef.current = {
        startedAt,
        durationMs: metrics.duration_ms,
        score: localResult.score,
        difficulty,
        metrics,
      };
    } finally {
      setSubmitting(false);
    }
  }, [canSave, difficulty, elapsedMs, maxCombo, missCount, rallyCount, refreshStats, score, sweetHits, userId]);

  const startRun = useCallback(() => {
    resetRun(difficulty);
    setPhase('running');
    startedAtRef.current = new Date().toISOString();
  }, [difficulty, resetRun]);

  useEffect(() => {
    if (phase !== 'running') return;
    const profile = difficultyProfile(difficulty);
    const paddleY = 0.92;
    const ballRadius = 0.018;
    const paddleHalfWidth = profile.paddleWidth * 0.5;
    const sweetHalfWidth = profile.paddleWidth * profile.sweetSpotRatio * 0.5;

    const tick = (now: number) => {
      const last = lastFrameRef.current ?? now;
      const dt = clamp(now - last, 4, 32);
      lastFrameRef.current = now;
      const dtScalar = dt / 16.6667;

      setElapsedMs((prev) => prev + dt);
      setPhysics((prev) => {
        let nextX = prev.ballX + prev.velX * dtScalar * 0.006;
        let nextY = prev.ballY + prev.velY * dtScalar * 0.006;
        let velX = prev.velX;
        let velY = prev.velY;

        if (nextX <= ballRadius) {
          nextX = ballRadius;
          velX = Math.abs(velX);
        } else if (nextX >= 1 - ballRadius) {
          nextX = 1 - ballRadius;
          velX = -Math.abs(velX);
        }
        if (nextY <= ballRadius) {
          nextY = ballRadius;
          velY = Math.abs(velY);
        }

        const crossingPaddle = nextY + ballRadius >= paddleY && velY > 0;
        const withinPaddle = Math.abs(nextX - prev.paddleX) <= paddleHalfWidth;
        if (crossingPaddle && withinPaddle) {
          const offset = (nextX - prev.paddleX) / Math.max(0.001, paddleHalfWidth);
          velY = -Math.abs(velY);
          velX = clamp(velX + offset * 0.12, -1.2, 1.2);
          const isSweet = Math.abs(nextX - prev.paddleX) <= sweetHalfWidth;

          setRallyCount((count) => {
            const nextCount = count + 1;
            if (nextCount % profile.rampEveryHits === 0) {
              velX *= profile.rampScale;
              velY *= profile.rampScale;
            }
            return nextCount;
          });
          setCombo((currentCombo) => {
            const nextCombo = currentCombo + 1;
            setMaxCombo((existing) => Math.max(existing, nextCombo));
            return nextCombo;
          });
          if (isSweet) setSweetHits((hits) => hits + 1);

          setScore((prevScore) => {
            const comboMultiplier = 1 + Math.min(0.5, Math.floor(combo / 5) * 0.1);
            const sweetBonus = isSweet ? 3 : 0;
            return prevScore + Math.round(10 * comboMultiplier + sweetBonus);
          });
          nextY = paddleY - ballRadius;
        }

        if (nextY >= 1 + ballRadius) {
          setMissCount((misses) => misses + 1);
          window.setTimeout(() => {
            void finishRun();
          }, 0);
          return prev;
        }

        return {
          ...prev,
          ballX: nextX,
          ballY: nextY,
          velX,
          velY,
        };
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [combo, difficulty, finishRun, phase]);

  const setPaddleX = useCallback((nextX: number) => {
    setPhysics((prev) => ({ ...prev, paddleX: clamp(nextX, 0.08, 0.92) }));
  }, []);

  const retrySave = useCallback(async () => {
    if (!submitPayloadRef.current || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const persisted = await submitPickleballRun(submitPayloadRef.current);
      setLastResult(persisted);
      submitPayloadRef.current = null;
      await refreshStats();
    } catch (retryError: any) {
      setError(retryError?.message || 'Retry failed');
    } finally {
      setSubmitting(false);
    }
  }, [refreshStats, userId]);

  const playAgain = useCallback(() => {
    resetRun(difficulty);
    setPhase('brief');
    setLastResult(null);
  }, [difficulty, resetRun]);

  const scoreDelta = useMemo(() => {
    const best = userStats?.best_score ?? 0;
    return score - best;
  }, [score, userStats?.best_score]);

  return {
    phase,
    difficulty,
    loading,
    submitting,
    error,
    canSave,
    physics,
    elapsedMs,
    score,
    rallyCount,
    combo,
    maxCombo,
    sweetHits,
    history,
    leaderboard,
    userStats,
    lastResult,
    scoreDelta,
    setDifficulty,
    setPaddleX,
    startRun,
    playAgain,
    retrySave,
    refreshStats,
  };
};
