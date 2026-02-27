import { supabase } from './supabase';
import { WorkspaceAreaPresenceRow } from '../types';

export const ENABLE_PERSISTENT_AREA_PRESENCE =
  String(import.meta.env?.VITE_ENABLE_PERSISTENT_AREA_PRESENCE ?? 'true').toLowerCase() !== 'false';

type AreaPresenceDbRow = {
  id: string;
  user_id: string;
  floor_id: string;
  x: number;
  y: number;
  status_message: string | null;
  is_present: boolean;
  last_seen_at: string;
  cleared_at: string | null;
  created_at: string;
  updated_at: string;
  profiles?:
    | {
        id: string;
        full_name: string | null;
        nickname: string | null;
        avatar_url: string | null;
        role: string | null;
      }[]
    | {
    id: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    role: string | null;
  }
    | null;
};

const mapRow = (row: AreaPresenceDbRow): WorkspaceAreaPresenceRow => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
  id: row.id,
  userId: row.user_id,
  floorId: row.floor_id,
  x: Number(row.x),
  y: Number(row.y),
  statusMessage: row.status_message || null,
  isPresent: Boolean(row.is_present),
  lastSeenAt: row.last_seen_at,
  clearedAt: row.cleared_at || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  displayName: profile?.nickname || profile?.full_name || 'User',
  avatarUrl: profile?.avatar_url || null,
  role: (profile?.role || undefined) as WorkspaceAreaPresenceRow['role'],
};
};

const getCurrentUserId = async (): Promise<string> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in.');
  return user.id;
};

export const workspaceAreaPresenceService = {
  async fetchActiveAreaPresence(): Promise<WorkspaceAreaPresenceRow[]> {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) return [];

    const { data, error } = await supabase
      .from('workspace_area_presence')
      .select(
        `
          id,
          user_id,
          floor_id,
          x,
          y,
          status_message,
          is_present,
          last_seen_at,
          cleared_at,
          created_at,
          updated_at,
          profiles:user_id (
            id,
            full_name,
            nickname,
            avatar_url,
            role
          )
        `,
      )
      .is('cleared_at', null)
      .eq('is_present', true);

    if (error) throw new Error(error.message);
    return (data || []).map((row) => mapRow(row as AreaPresenceDbRow));
  },

  async upsertMyAreaPresence(payload: { floorId: string; x: number; y: number; statusMessage?: string | null }): Promise<void> {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) return;

    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const updatePayload = {
      floor_id: payload.floorId,
      x: payload.x,
      y: payload.y,
      status_message: payload.statusMessage ?? null,
      is_present: true,
      last_seen_at: now,
      cleared_at: null as string | null,
      updated_at: now,
    };

    const { data: updatedRows, error: updateError } = await supabase
      .from('workspace_area_presence')
      .update(updatePayload)
      .eq('user_id', userId)
      .is('cleared_at', null)
      .select('id')
      .limit(1);

    if (updateError) throw new Error(updateError.message);
    if ((updatedRows || []).length > 0) return;

    const { error: insertError } = await supabase.from('workspace_area_presence').insert({
      user_id: userId,
      ...updatePayload,
      created_at: now,
    });
    if (insertError) throw new Error(insertError.message);
  },

  async clearMyAreaPresence(): Promise<void> {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) return;
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('workspace_area_presence')
      .update({
        is_present: false,
        cleared_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .is('cleared_at', null);
    if (error) throw new Error(error.message);
  },

  async setMyAreaPresenceStatus(statusMessage: string | null): Promise<void> {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) return;
    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('workspace_area_presence')
      .update({
        status_message: statusMessage,
        last_seen_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .is('cleared_at', null);
    if (error) throw new Error(error.message);
  },

  subscribeAreaPresenceChanges(onRefreshRequested: () => void) {
    if (!ENABLE_PERSISTENT_AREA_PRESENCE) {
      return () => undefined;
    }

    const channel = supabase
      .channel('workspace-area-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_area_presence',
        },
        () => onRefreshRequested(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
