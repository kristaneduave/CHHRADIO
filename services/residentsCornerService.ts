import { PickleballUserStats, Profile, UserRole } from '../types';
import { supabase } from './supabase';
import { getUserRoleState } from './userRoleService';

export interface ResidentsCornerBootstrapData {
  currentUser: any | null;
  currentUserRole: UserRole | null;
  currentUserRoles: UserRole[];
  coverOverrides: Record<string, any[]>;
  profiles: Record<string, Profile>;
}

let residentsCornerBootstrapCache: ResidentsCornerBootstrapData | null = null;
let residentsCornerBootstrapPromise: Promise<ResidentsCornerBootstrapData> | null = null;

const fetchProfilesMap = async (): Promise<Record<string, Profile>> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    throw error;
  }

  const profileMap: Record<string, Profile> = {};
  (data || []).forEach((profile: any) => {
    profileMap[profile.id] = profile;
  });

  return profileMap;
};

const fetchCoverOverrides = async (): Promise<Record<string, any[]>> => {
  const { data, error } = await supabase
    .from('consultant_covers')
    .select('*');

  if (error) {
    throw error;
  }

  const overrides: Record<string, any[]> = {};
  (data || []).forEach((row: any) => {
    const entry = {
      id: row.id,
      doctorName: row.doctor_name,
      scope: row.scope,
      informed: row.informed,
      readStatus: row.read_status,
      informedBy: row.informed_by,
      logs: row.logs || [],
    };

    if (!overrides[row.slot_id]) {
      overrides[row.slot_id] = [];
    }

    overrides[row.slot_id].push(entry);
  });

  return overrides;
};

const fetchResidentsCornerBootstrap = async (): Promise<ResidentsCornerBootstrapData> => {
  const { data: { user } } = await supabase.auth.getUser();
  const roleState = user?.id ? await getUserRoleState(user.id) : null;

  const [coverOverrides, profiles] = await Promise.all([
    fetchCoverOverrides(),
    fetchProfilesMap(),
  ]);

  return {
    currentUser: user || null,
    currentUserRole: roleState?.primaryRole || null,
    currentUserRoles: roleState?.roles || [],
    coverOverrides,
    profiles,
  };
};

export const getResidentsCornerBootstrap = async (options?: { force?: boolean }): Promise<ResidentsCornerBootstrapData> => {
  const force = Boolean(options?.force);

  if (!force && residentsCornerBootstrapCache) {
    return residentsCornerBootstrapCache;
  }

  if (!force && residentsCornerBootstrapPromise) {
    return residentsCornerBootstrapPromise;
  }

  residentsCornerBootstrapPromise = fetchResidentsCornerBootstrap()
    .then((data) => {
      residentsCornerBootstrapCache = data;
      return data;
    })
    .finally(() => {
      residentsCornerBootstrapPromise = null;
    });

  return residentsCornerBootstrapPromise;
};

export const preloadResidentsCornerBootstrap = async (): Promise<void> => {
  await getResidentsCornerBootstrap();
};

export const getCachedResidentsCornerBootstrap = (): ResidentsCornerBootstrapData | null =>
  residentsCornerBootstrapCache;
