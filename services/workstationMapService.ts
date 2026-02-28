import { AssignOccupancyPayload, AssignableOccupant, CurrentWorkstationStatus, Floor } from '../types';
import { supabase } from './supabase';

const ACTIVE_WINDOW_MINUTES = 30;
const ASSIGNED_TTL_HOURS = 8;

const nowIso = () => new Date().toISOString();

const toIsoAfterHours = (hours: number): string => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const isSessionActive = (session: any): boolean => {
  if (!session || session.ended_at) return false;
  if (!session.expires_at) return true;
  const expiresMs = new Date(session.expires_at).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > Date.now();
};

interface OccupancySchemaCapabilities {
  hasExpiresAt: boolean;
  hasV3AssignmentColumns: boolean;
}

let occupancyCapabilities: OccupancySchemaCapabilities = {
  hasExpiresAt: true,
  hasV3AssignmentColumns: true,
};
const occupancyOwnershipCache = new Map<string, { at: number; value: boolean }>();
const OCCUPANT_PROFILE_CACHE_TTL_MS = 60_000;
const occupantProfileCache = new Map<
  string,
  { at: number; value: { nickname: string | null; fullName: string | null; avatarUrl: string | null; role: any } }
>();

const isMissingColumnError = (message?: string): boolean =>
  Boolean(
    message &&
    (/column .+ does not exist/i.test(message) ||
      /could not find the '.+' column of '.+' in the schema cache/i.test(message)),
  );

const getActorProfile = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, full_name')
    .eq('id', userId)
    .single();
  return profile;
};

const getActiveSessionByWorkstation = async (workstationId: string): Promise<any | null> => {
  const now = nowIso();

  const runLegacyQuery = async () => {
    const { data, error } = await supabase
      .from('occupancy_sessions')
      .select('id,ended_at')
      .eq('workstation_id', workstationId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    return (data || [])[0] || null;
  };

  if (!occupancyCapabilities.hasExpiresAt) {
    const legacyCandidate = await runLegacyQuery();
    return legacyCandidate && isSessionActive(legacyCandidate) ? legacyCandidate : null;
  }

  const { data, error } = await supabase
    .from('occupancy_sessions')
    .select('id,ended_at,expires_at')
    .eq('workstation_id', workstationId)
    .is('ended_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('started_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingColumnError(error.message)) {
      occupancyCapabilities = { ...occupancyCapabilities, hasExpiresAt: false };
      const legacyCandidate = await runLegacyQuery();
      return legacyCandidate && isSessionActive(legacyCandidate) ? legacyCandidate : null;
    }
    throw new Error(error.message);
  }

  const candidate = (data || [])[0];
  return candidate && isSessionActive(candidate) ? candidate : null;
};

const insertOccupancySession = async (
  v3Payload: Record<string, any>,
  legacyPayload: Record<string, any>,
): Promise<void> => {
  if (occupancyCapabilities.hasV3AssignmentColumns) {
    const { error: v3Error } = await supabase.from('occupancy_sessions').insert(v3Payload);
    if (!v3Error) return;
    if (!isMissingColumnError(v3Error.message)) throw new Error(v3Error.message);
    occupancyCapabilities = { ...occupancyCapabilities, hasV3AssignmentColumns: false };
  }

  const { error } = await supabase.from('occupancy_sessions').insert(legacyPayload);
  if (error) throw new Error(error.message);
};

const clearOccupancyOwnershipCache = (workstationId?: string) => {
  if (!workstationId) {
    occupancyOwnershipCache.clear();
    return;
  }
  occupancyOwnershipCache.delete(workstationId);
};

export const workstationMapService = {
  async getFloors(): Promise<Floor[]> {
    const { data, error } = await supabase.from('floors').select('*').order('name');
    if (error) {
      console.error('Error fetching floors:', error);
      throw new Error(error.message);
    }

    return (data || []).map((floor: any) => {
      const width = Number(floor.width);
      const height = Number(floor.height);
      return {
        ...floor,
        image_url: floor.image_url || '/mock-map.png',
        width: Number.isFinite(width) && width > 0 ? width : 735,
        height: Number.isFinite(height) && height > 0 ? height : 824,
      } as Floor;
    });
  },

  async getWorkstationsByFloor(floorId: string): Promise<CurrentWorkstationStatus[]> {
    const { data, error } = await supabase
      .from('current_workstation_status')
      .select('*')
      .eq('floor_id', floorId);

    if (error) {
      console.error('Error fetching workstations:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async hydrateWorkstationOccupants(
    workstations: CurrentWorkstationStatus[],
  ): Promise<CurrentWorkstationStatus[]> {
    const now = Date.now();
    const occupantIds = Array.from(
      new Set(
        workstations
          .map((ws) => ws.occupant_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (!occupantIds.length) return workstations;

    const missingIds = occupantIds.filter((id) => {
      const cached = occupantProfileCache.get(id);
      return !cached || now - cached.at > OCCUPANT_PROFILE_CACHE_TTL_MS;
    });

    if (missingIds.length) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, avatar_url, role')
        .in('id', missingIds);

      if (error) {
        console.error('Error hydrating workstation occupants:', error);
      } else {
        (data || []).forEach((profile: any) => {
          occupantProfileCache.set(String(profile.id), {
            at: now,
            value: {
              nickname: (profile.nickname as string | null) || null,
              fullName: (profile.full_name as string | null) || null,
              avatarUrl: (profile.avatar_url as string | null) || null,
              role: (profile.role as any) || null,
            },
          });
        });
      }
    }

    return workstations.map((ws) => {
      const profile = ws.occupant_id ? occupantProfileCache.get(ws.occupant_id)?.value : null;
      if (!profile) return ws;
      return {
        ...ws,
        occupant_avatar_url: profile.avatarUrl,
        occupant_role: profile.role,
        occupant_nickname: profile.nickname,
        occupant_name: ws.occupant_name || profile.nickname || profile.fullName || ws.occupant_name || null,
      };
    });
  },

  async searchAssignableOccupants(query: string): Promise<AssignableOccupant[]> {
    const q = query.trim();
    if (!q) return [];

    let supabaseQuery = supabase
      .from('profiles')
      .select('id, full_name, nickname, avatar_url, role')
      .limit(12);

    const escaped = q.replace(/[%_]/g, '\\$&');
    supabaseQuery = supabaseQuery.or(
      `full_name.ilike.%${escaped}%,nickname.ilike.%${escaped}%,username.ilike.%${escaped}%`,
    );

    const { data, error } = await supabaseQuery;
    if (error) throw new Error(error.message);

    return (data || []).map((profile: any) => ({
      id: String(profile.id),
      displayName: profile.nickname || profile.full_name || `User ${String(profile.id).slice(0, 6)}`,
      role: profile.role || undefined,
      avatarUrl: profile.avatar_url || null,
    }));
  },

  async updateStatusMessage(workstationId: string, message: string | null): Promise<void> {
    const activeSession = await getActiveSessionByWorkstation(workstationId);
    if (!activeSession) throw new Error('No active session found for this workstation.');

    const { error: updateError } = await supabase
      .from('occupancy_sessions')
      .update({ status_message: message })
      .eq('id', activeSession.id);

    if (updateError) throw new Error(updateError.message);
  },

  async claimWorkstation(workstationId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to claim a workstation.');

    const activeSession = await getActiveSessionByWorkstation(workstationId);
    if (activeSession) throw new Error('Workstation is already occupied.');

    const profile = await getActorProfile(user.id);
    const displayName = profile?.nickname || profile?.full_name || 'Staff';
    const legacyPayload: Record<string, any> = {
      workstation_id: workstationId,
      user_id: user.id,
      display_name_snapshot: displayName,
      client_type: 'web',
    };
    const v3Payload = {
      ...legacyPayload,
      occupant_user_id: user.id,
      occupant_display_name: displayName,
      occupancy_mode: 'self',
      expires_at: null,
      assigned_by_user_id: null,
    };

    await insertOccupancySession(v3Payload, legacyPayload);
    clearOccupancyOwnershipCache(workstationId);
  },

  async assignWorkstation(workstationId: string, payload: AssignOccupancyPayload): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to assign a workstation.');

    const activeSession = await getActiveSessionByWorkstation(workstationId);
    if (activeSession) throw new Error('Workstation is already occupied.');

    if (payload.mode === 'assigned_user') {
      const occupantUserId = payload.occupantUserId?.trim();
      if (!occupantUserId) throw new Error('Please choose a user to assign.');

      const { data: occupantProfile, error: occupantError } = await supabase
        .from('profiles')
        .select('nickname, full_name')
        .eq('id', occupantUserId)
        .single();
      if (occupantError) throw new Error(occupantError.message);

      const occupantDisplayName = occupantProfile?.nickname || occupantProfile?.full_name || 'Staff';

      const legacyPayload: Record<string, any> = {
        workstation_id: workstationId,
        user_id: user.id,
        display_name_snapshot: occupantDisplayName,
        client_type: 'web',
        status_message: payload.statusMessage || null,
      };
      const v3Payload = {
        ...legacyPayload,
        occupant_user_id: occupantUserId,
        occupant_display_name: occupantDisplayName,
        occupancy_mode: 'assigned_user',
        assigned_by_user_id: user.id,
        expires_at: toIsoAfterHours(ASSIGNED_TTL_HOURS),
      };
      await insertOccupancySession(v3Payload, legacyPayload);
      clearOccupancyOwnershipCache(workstationId);
      return;
    }

    const externalName = payload.occupantDisplayName?.trim();
    if (!externalName) throw new Error('Please enter an external occupant name.');

    const legacyPayload: Record<string, any> = {
      workstation_id: workstationId,
      user_id: user.id,
      display_name_snapshot: externalName,
      client_type: 'web',
      status_message: payload.statusMessage || null,
    };
    const v3Payload = {
      ...legacyPayload,
      occupant_user_id: null,
      occupant_display_name: externalName,
      occupancy_mode: 'assigned_external',
      assigned_by_user_id: user.id,
      expires_at: toIsoAfterHours(ASSIGNED_TTL_HOURS),
    };

    await insertOccupancySession(v3Payload, legacyPayload);
    clearOccupancyOwnershipCache(workstationId);
  },

  async releaseWorkstation(workstationId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not logged in.');

    const activeSession = await getActiveSessionByWorkstation(workstationId);
    // Idempotent release: allow UX to continue even if session already ended
    // or view state briefly lags behind the database.
    if (!activeSession) return;

    const { error: updateError } = await supabase
      .from('occupancy_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', activeSession.id);

    if (updateError) throw new Error(updateError.message);
    clearOccupancyOwnershipCache(workstationId);
  },

  async isCurrentUserOccupyingWorkstation(
    workstationId: string,
    options?: { maxAgeMs?: number },
  ): Promise<boolean> {
    const maxAgeMs = options?.maxAgeMs ?? 0;
    if (maxAgeMs > 0) {
      const cached = occupancyOwnershipCache.get(workstationId);
      if (cached && Date.now() - cached.at <= maxAgeMs) {
        return cached.value;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      occupancyOwnershipCache.set(workstationId, { at: Date.now(), value: false });
      return false;
    }

    const activeSession = await getActiveSessionByWorkstation(workstationId);
    if (!activeSession) {
      occupancyOwnershipCache.set(workstationId, { at: Date.now(), value: false });
      return false;
    }

    const { data, error } = await supabase
      .from('occupancy_sessions')
      .select('id,user_id')
      .eq('id', activeSession.id)
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      console.error('Failed to verify current occupancy ownership:', error);
      return false;
    }

    const isOwner = Boolean((data || [])[0]);
    occupancyOwnershipCache.set(workstationId, { at: Date.now(), value: isOwner });
    return isOwner;
  },
};
