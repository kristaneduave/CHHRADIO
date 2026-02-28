import { FALLBACK_NEEDLE_SCENARIOS } from '../data/needleScenarios';
import {
  NeedleLeaderboardRow,
  NeedleRunEvent,
  NeedleScenario,
  NeedleScoreBreakdown,
  NeedleSessionMetrics,
  NeedleSessionResult,
  NeedleUserStats,
} from '../types';
import { supabase } from './supabase';

type SubmitNeedlePayload = {
  scenarioId: string;
  startedAt: string;
  durationMs: number;
  score: number;
  competencyBand: NeedleSessionResult['competency_band'];
  metrics: NeedleSessionMetrics;
  breakdown: NeedleScoreBreakdown;
  events: NeedleRunEvent[];
};

const toError = (error: unknown, fallback: string): Error => {
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message ?? fallback));
  }
  return new Error(fallback);
};

const normalizeNeedleResult = (row: any): NeedleSessionResult => ({
  id: String(row.id),
  scenario_id: String(row.scenario_id),
  user_id: row.user_id ? String(row.user_id) : null,
  started_at: String(row.started_at),
  completed_at: String(row.completed_at),
  duration_ms: Number(row.duration_ms) || 0,
  score: Number(row.score) || 0,
  competency_band: (row.competency_band as NeedleSessionResult['competency_band']) || 'Needs Practice',
  metrics: (row.metrics || {}) as NeedleSessionMetrics,
  breakdown: (row.breakdown || {
    accuracy: 0,
    trajectory: 0,
    safety: 0,
    efficiency: 0,
  }) as NeedleScoreBreakdown,
});

export const listNeedleScenarios = async (): Promise<NeedleScenario[]> => {
  const { data, error } = await supabase
    .from('needle_scenarios')
    .select('*')
    .eq('is_active', true)
    .order('difficulty', { ascending: true });

  if (error) {
    return FALLBACK_NEEDLE_SCENARIOS;
  }

  const scenarios = (data ?? []) as NeedleScenario[];
  if (!scenarios.length) {
    return FALLBACK_NEEDLE_SCENARIOS;
  }
  return scenarios;
};

export const submitNeedleSession = async (
  payload: SubmitNeedlePayload,
): Promise<NeedleSessionResult> => {
  const completedAt = new Date(new Date(payload.startedAt).getTime() + payload.durationMs).toISOString();

  const rpcResult = await supabase.rpc('submit_needle_session', {
    p_scenario_id: payload.scenarioId,
    p_started_at: payload.startedAt,
    p_duration_ms: payload.durationMs,
    p_score: payload.score,
    p_competency_band: payload.competencyBand,
    p_metrics: payload.metrics,
    p_breakdown: payload.breakdown,
    p_events: payload.events,
  });

  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (row) {
      return normalizeNeedleResult(row);
    }
  }

  const fallbackInsert = await supabase
    .from('needle_sessions')
    .insert({
      scenario_id: payload.scenarioId,
      started_at: payload.startedAt,
      completed_at: completedAt,
      duration_ms: payload.durationMs,
      score: payload.score,
      competency_band: payload.competencyBand,
      metrics: payload.metrics,
      breakdown: payload.breakdown,
    })
    .select('*')
    .single();

  if (fallbackInsert.error) {
    throw toError(fallbackInsert.error, 'Failed to submit needle session');
  }

  return normalizeNeedleResult(fallbackInsert.data);
};

export const getNeedleHistory = async (
  userId: string,
  limit = 10,
): Promise<NeedleSessionResult[]> => {
  const { data, error } = await supabase
    .from('needle_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data ?? []).map(normalizeNeedleResult);
};

export const getNeedleLeaderboard = async (
  window: '7d' | '30d',
): Promise<NeedleLeaderboardRow[]> => {
  const viewName = window === '7d' ? 'needle_leaderboard_7d_v' : 'needle_leaderboard_30d_v';
  const { data, error } = await supabase.from(viewName).select('*').limit(25);

  if (error) {
    return [];
  }

  return (data ?? []).map((row: any) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name ?? 'Unknown'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    role: (row.role || null) as NeedleLeaderboardRow['role'],
    runs_count: Number(row.runs_count) || 0,
    avg_score: Number(row.avg_score) || 0,
    best_score: Number(row.best_score) || 0,
  }));
};

export const getNeedleUserStats = async (userId: string): Promise<NeedleUserStats | null> => {
  const { data, error } = await supabase
    .from('needle_user_stats_v')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    user_id: String(data.user_id),
    runs_count: Number(data.runs_count) || 0,
    avg_score: Number(data.avg_score) || 0,
    best_score: Number(data.best_score) || 0,
    excellent_count: Number(data.excellent_count) || 0,
  };
};
