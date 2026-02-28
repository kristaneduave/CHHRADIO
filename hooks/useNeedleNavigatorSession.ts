import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FALLBACK_NEEDLE_SCENARIOS } from '../data/needleScenarios';
import {
  NeedleLeaderboardRow,
  NeedleRunEvent,
  NeedleScenario,
  NeedleSessionMetrics,
  NeedleSessionResult,
  NeedleUserStats,
} from '../types';
import {
  getNeedleHistory,
  getNeedleLeaderboard,
  getNeedleUserStats,
  listNeedleScenarios,
  submitNeedleSession,
} from '../services/needleNavigatorService';
import {
  NeedleEvaluation,
  NeedleTargetState,
  calculateNeedleTip,
  calculateTargetState,
  evaluateNeedleState,
  scoreNeedleSession,
} from '../utils/needlePhysics';

type SessionPhase = 'brief' | 'running' | 'debrief';

interface SessionMetricsInternal {
  redirects: number;
  punctureAttempts: number;
  riskHits: number;
  riskExposureMs: number;
  nearMissMs: number;
  minDistancePx: number;
  stableMsAtCommit: number;
}

const MAX_ABS_ANGLE = 70;
const MIN_DEPTH = 0;
const STABLE_MS_REQUIRED = 400;

const createEvent = (eventType: NeedleRunEvent['event_type'], meta: Record<string, unknown> = {}): NeedleRunEvent => ({
  event_type: eventType,
  event_at: new Date().toISOString(),
  meta,
});

export const useNeedleNavigatorSession = (userId: string | null) => {
  const [phase, setPhase] = useState<SessionPhase>('brief');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<NeedleScenario[]>([]);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [angleDeg, setAngleDeg] = useState(0);
  const [depthPx, setDepthPx] = useState(0);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [targetState, setTargetState] = useState<NeedleTargetState | null>(null);
  const [evaluation, setEvaluation] = useState<NeedleEvaluation | null>(null);
  const [stableMs, setStableMs] = useState(0);
  const [lastResult, setLastResult] = useState<NeedleSessionResult | null>(null);
  const [history, setHistory] = useState<NeedleSessionResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<NeedleLeaderboardRow[]>([]);
  const [userStats, setUserStats] = useState<NeedleUserStats | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const startMsRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef<number | null>(null);
  const wasInsideRiskRef = useRef(false);
  const eventsRef = useRef<NeedleRunEvent[]>([]);
  const metricsRef = useRef<SessionMetricsInternal>({
    redirects: 0,
    punctureAttempts: 0,
    riskHits: 0,
    riskExposureMs: 0,
    nearMissMs: 0,
    minDistancePx: Number.POSITIVE_INFINITY,
    stableMsAtCommit: 0,
  });
  const previousDepthRef = useRef(0);
  const previousDirectionRef = useRef<'advance' | 'retract' | null>(null);

  const scenario = useMemo(
    () => scenarios[scenarioIndex] ?? FALLBACK_NEEDLE_SCENARIOS[0],
    [scenarioIndex, scenarios],
  );

  const needleEntry = useMemo(
    () => ({ x: scenario.needle_entry_x, y: scenario.needle_entry_y }),
    [scenario.needle_entry_x, scenario.needle_entry_y],
  );

  const tip = useMemo(
    () => calculateNeedleTip(needleEntry, angleDeg, depthPx),
    [needleEntry, angleDeg, depthPx],
  );

  const refreshStats = useCallback(async () => {
    if (!userId) return;
    const [nextHistory, nextLeaderboard, nextStats] = await Promise.all([
      getNeedleHistory(userId),
      getNeedleLeaderboard('7d'),
      getNeedleUserStats(userId),
    ]);
    setHistory(nextHistory);
    setLeaderboard(nextLeaderboard);
    setUserStats(nextStats);
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await listNeedleScenarios();
        if (!mounted) return;
        setScenarios(loaded.length ? loaded : FALLBACK_NEEDLE_SCENARIOS);
      } catch (err) {
        if (!mounted) return;
        setScenarios(FALLBACK_NEEDLE_SCENARIOS);
        setError(err instanceof Error ? err.message : 'Unable to load scenarios');
      } finally {
        if (mounted) setLoading(false);
      }

      if (mounted && userId) {
        refreshStats().catch(() => undefined);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [refreshStats, userId]);

  const resetRunState = useCallback(() => {
    setAngleDeg(0);
    setDepthPx(0);
    setElapsedMs(0);
    setTargetState(null);
    setEvaluation(null);
    setStableMs(0);

    startedAtRef.current = null;
    startMsRef.current = null;
    lastFrameMsRef.current = null;
    wasInsideRiskRef.current = false;
    previousDepthRef.current = 0;
    previousDirectionRef.current = null;
    metricsRef.current = {
      redirects: 0,
      punctureAttempts: 0,
      riskHits: 0,
      riskExposureMs: 0,
      nearMissMs: 0,
      minDistancePx: Number.POSITIVE_INFINITY,
      stableMsAtCommit: 0,
    };
    eventsRef.current = [];
  }, []);

  const startRun = useCallback(() => {
    resetRunState();
    startedAtRef.current = new Date().toISOString();
    eventsRef.current.push(createEvent('start', { scenarioId: scenario.id }));
    setPhase('running');
  }, [resetRunState, scenario.id]);

  const finishSession = useCallback(
    async (didSucceed: boolean) => {
      if (phase !== 'running') return;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      const startedAt = startedAtRef.current ?? new Date().toISOString();
      const finalElapsed = Math.round(elapsedMs);

      const metrics: NeedleSessionMetrics = {
        elapsed_ms: finalElapsed,
        puncture_attempts: metricsRef.current.punctureAttempts,
        redirects: metricsRef.current.redirects,
        risk_hits: metricsRef.current.riskHits,
        risk_exposure_ms: Math.round(metricsRef.current.riskExposureMs),
        near_miss_ms: Math.round(metricsRef.current.nearMissMs),
        stable_ms_at_commit: Math.round(metricsRef.current.stableMsAtCommit),
        final_distance_px: Number.isFinite(metricsRef.current.minDistancePx)
          ? Math.round(metricsRef.current.minDistancePx * 100) / 100
          : 999,
        success: didSucceed,
      };

      const scoring = scoreNeedleSession(metrics, scenario);
      const localResult: NeedleSessionResult = {
        id: `local-${Date.now()}`,
        scenario_id: scenario.id,
        user_id: userId,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: finalElapsed,
        score: scoring.score,
        competency_band: scoring.competencyBand,
        metrics,
        breakdown: scoring.breakdown,
      };

      setSubmitting(true);
      setError(null);
      try {
        const persisted = await submitNeedleSession({
          scenarioId: scenario.id,
          startedAt,
          durationMs: finalElapsed,
          score: scoring.score,
          competencyBand: scoring.competencyBand,
          metrics,
          breakdown: scoring.breakdown,
          events: eventsRef.current,
        });
        setLastResult(persisted);
      } catch (err) {
        setLastResult(localResult);
        setError(err instanceof Error ? err.message : 'Failed to save result');
      } finally {
        setSubmitting(false);
      }

      setPhase('debrief');
      if (userId) {
        refreshStats().catch(() => undefined);
      }
    },
    [elapsedMs, phase, refreshStats, scenario, userId],
  );

  useEffect(() => {
    if (phase !== 'running') return;

    const tick = (frameNow: number) => {
      if (startMsRef.current === null) {
        startMsRef.current = frameNow;
        lastFrameMsRef.current = frameNow;
      }

      const elapsed = frameNow - startMsRef.current;
      const dt = Math.max(0, frameNow - (lastFrameMsRef.current ?? frameNow));
      lastFrameMsRef.current = frameNow;
      setElapsedMs(elapsed);

      const target = calculateTargetState(scenario, elapsed);
      setTargetState(target);

      const nextEval = evaluateNeedleState(scenario, tip, target);
      setEvaluation(nextEval);
      metricsRef.current.minDistancePx = Math.min(
        metricsRef.current.minDistancePx,
        nextEval.tipDistanceToTargetCenter,
      );

      if (nextEval.insideTarget) {
        setStableMs((prev) => prev + dt);
      } else {
        setStableMs(0);
      }

      if (nextEval.insideRisk) {
        metricsRef.current.riskExposureMs += dt;
        if (!wasInsideRiskRef.current) {
          metricsRef.current.riskHits += 1;
          eventsRef.current.push(createEvent('risk_enter', { elapsedMs: elapsed }));
        }
      } else if (wasInsideRiskRef.current) {
        eventsRef.current.push(createEvent('risk_exit', { elapsedMs: elapsed }));
      }

      if (nextEval.nearRisk) {
        metricsRef.current.nearMissMs += dt;
      }

      wasInsideRiskRef.current = nextEval.insideRisk;

      if (elapsed >= scenario.time_limit_sec * 1000) {
        eventsRef.current.push(createEvent('timeout', { elapsedMs: elapsed }));
        void finishSession(false);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
    };
  }, [finishSession, phase, scenario, tip]);

  const setAngle = useCallback((nextAngle: number) => {
    const clamped = Math.round(Math.max(-MAX_ABS_ANGLE, Math.min(MAX_ABS_ANGLE, nextAngle)));
    setAngleDeg(clamped);
    if (phase === 'running') {
      eventsRef.current.push(createEvent('angle_change', { value: clamped }));
    }
  }, [phase]);

  const setDepth = useCallback((nextDepth: number) => {
    const clamped = Math.round(Math.max(MIN_DEPTH, Math.min(scenario.max_depth, nextDepth)));
    const prev = previousDepthRef.current;
    if (phase === 'running') {
      const direction: 'advance' | 'retract' | null =
        clamped > prev ? 'advance' : clamped < prev ? 'retract' : null;
      if (direction && previousDirectionRef.current && previousDirectionRef.current !== direction) {
        metricsRef.current.redirects += 1;
      }
      if (direction) {
        previousDirectionRef.current = direction;
      }
      eventsRef.current.push(createEvent('depth_change', { value: clamped }));
    }
    previousDepthRef.current = clamped;
    setDepthPx(clamped);
  }, [phase, scenario.max_depth]);

  const commitPuncture = useCallback(() => {
    if (phase !== 'running') return;
    metricsRef.current.punctureAttempts += 1;
    metricsRef.current.stableMsAtCommit = stableMs;
    eventsRef.current.push(
      createEvent('commit_attempt', { stableMs, depthPx, angleDeg, insideTarget: evaluation?.insideTarget }),
    );

    const isSuccess = Boolean(evaluation?.insideTarget) && stableMs >= STABLE_MS_REQUIRED;
    if (isSuccess) {
      eventsRef.current.push(createEvent('success', { stableMs, elapsedMs }));
      void finishSession(true);
    }
  }, [angleDeg, depthPx, elapsedMs, evaluation?.insideTarget, finishSession, phase, stableMs]);

  const retryScenario = useCallback(() => {
    setLastResult(null);
    setPhase('brief');
    resetRunState();
  }, [resetRunState]);

  const nextScenario = useCallback(() => {
    setLastResult(null);
    setScenarioIndex((prev) => ((prev + 1) % Math.max(1, scenarios.length)));
    setPhase('brief');
    resetRunState();
  }, [resetRunState, scenarios.length]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    loading,
    submitting,
    error,
    phase,
    scenario,
    scenarios,
    scenarioIndex,
    angleDeg,
    depthPx,
    elapsedMs,
    stableMs,
    tip,
    targetState,
    evaluation,
    history,
    leaderboard,
    userStats,
    lastResult,
    setScenarioIndex,
    startRun,
    setAngle,
    setDepth,
    commitPuncture,
    retryScenario,
    nextScenario,
    refreshStats,
  };
};
