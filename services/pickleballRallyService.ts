import {
  PickleballDifficulty,
  PickleballLeaderboardRow,
  PickleballRunMetrics,
  PickleballRunResult,
  PickleballUserStats,
} from '../types';
import { supabase } from './supabase';

type SubmitPickleballPayload = {
  startedAt: string;
  durationMs: number;
  score: number;
  difficulty: PickleballDifficulty;
  metrics: PickleballRunMetrics;
};

const normalizePickleballResult = (row: any): PickleballRunResult => ({
  id: String(row.id),
  user_id: row.user_id ? String(row.user_id) : null,
  score: Number(row.score) || 0,
  difficulty: (row.difficulty as PickleballDifficulty) || 'intermediate',
  metrics: {
    duration_ms: Number(row.metrics?.duration_ms ?? row.duration_ms) || 0,
    rally_count: Number(row.metrics?.rally_count) || 0,
    max_combo: Number(row.metrics?.max_combo) || 0,
    miss_count: Number(row.metrics?.miss_count) || 0,
    sweet_hits: Number(row.metrics?.sweet_hits) || 0,
  },
  started_at: String(row.started_at),
  completed_at: String(row.completed_at),
});

export const submitPickleballRun = async (
  payload: SubmitPickleballPayload,
): Promise<PickleballRunResult> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('You must be signed in to save a run.');
  }

  const completedAt = new Date(new Date(payload.startedAt).getTime() + payload.durationMs).toISOString();
  const { data, error } = await supabase
    .from('pickleball_runs')
    .insert({
      user_id: user.id,
      started_at: payload.startedAt,
      completed_at: completedAt,
      score: Math.max(0, Math.round(payload.score)),
      difficulty: payload.difficulty,
      metrics: {
        duration_ms: Math.max(0, Math.round(payload.metrics.duration_ms)),
        rally_count: Math.max(0, Math.round(payload.metrics.rally_count)),
        max_combo: Math.max(0, Math.round(payload.metrics.max_combo)),
        miss_count: Math.max(0, Math.round(payload.metrics.miss_count)),
        sweet_hits: Math.max(0, Math.round(payload.metrics.sweet_hits)),
      },
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message || 'Failed to submit run');
  return normalizePickleballResult(data);
};

export const getPickleballHistory = async (
  userId: string,
  limit = 10,
): Promise<PickleballRunResult[]> => {
  const { data, error } = await supabase
    .from('pickleball_runs')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data || []).map(normalizePickleballResult);
};

export const getPickleballLeaderboard = async (
  window: '7d' | '30d',
): Promise<PickleballLeaderboardRow[]> => {
  const viewName = window === '7d' ? 'pickleball_leaderboard_7d_v' : 'pickleball_leaderboard_30d_v';
  const { data, error } = await supabase.from(viewName).select('*').limit(25);
  if (error) return [];

  return (data || []).map((row: any) => ({
    user_id: String(row.user_id),
    display_name: String(row.display_name ?? 'Unknown'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    role: (row.role || null) as PickleballLeaderboardRow['role'],
    runs_count: Number(row.runs_count) || 0,
    avg_score: Number(row.avg_score) || 0,
    best_score: Number(row.best_score) || 0,
  }));
};

export const getPickleballUserStats = async (userId: string): Promise<PickleballUserStats | null> => {
  const { data, error } = await supabase
    .from('pickleball_user_stats_v')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    user_id: String(data.user_id),
    runs_count: Number(data.runs_count) || 0,
    avg_score: Number(data.avg_score) || 0,
    best_score: Number(data.best_score) || 0,
    top10_count: Number(data.top10_count) || 0,
  };
};
