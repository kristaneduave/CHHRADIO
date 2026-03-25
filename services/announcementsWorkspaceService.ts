import { UserRole } from '../types';
import { fetchHiddenAnnouncementIds } from './announcementVisibilityService';
import { supabase } from './supabase';
import { getCurrentUserRoleState } from './userRoleService';
import { fetchWithCache, invalidateCacheByPrefix } from '../utils/requestCache';

export interface AnnouncementWorkspaceRow {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: string;
  author_id: string;
  image_url?: string | null;
  views?: number | null;
  attachments?: any[] | null;
  external_link?: string | null;
  links?: Array<{ url: string; title: string }> | null;
  icon?: string | null;
  is_pinned?: boolean | null;
  is_important?: boolean | null;
  pinned_at?: string | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    nickname?: string | null;
  } | null;
}

export interface AnnouncementsWorkspaceData {
  currentUserId: string;
  userRoles: UserRole[];
  hiddenAnnouncementIds: string[];
  announcements: AnnouncementWorkspaceRow[];
}

let supportsAnnouncementPriorityColumns = true;
let announcementsWorkspaceCache: AnnouncementsWorkspaceData | null = null;
let announcementsWorkspacePromise: Promise<AnnouncementsWorkspaceData> | null = null;

const isMissingPriorityColumnError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('is_pinned') || message.includes('is_important') || message.includes('pinned_at');
};

const queryAnnouncementPage = async (from: number, to: number) => {
  if (supportsAnnouncementPriorityColumns) {
    const prioritized = await fetchWithCache(
      `announcements:page:priority:${from}:${to}`,
      () =>
        supabase
          .from('announcements')
          .select(
            `*,
            profiles:author_id (
              full_name,
              avatar_url,
              role,
              nickname
            )`,
          )
          .order('is_pinned', { ascending: false })
          .order('is_important', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to),
      { ttlMs: 10_000, allowStaleWhileRevalidate: true },
    );

    if (!prioritized.error) return prioritized;
    if (!isMissingPriorityColumnError(prioritized.error)) return prioritized;
    supportsAnnouncementPriorityColumns = false;
    invalidateCacheByPrefix('announcements:page:priority:');
  }

  return fetchWithCache(
    `announcements:page:default:${from}:${to}`,
    () =>
      supabase
        .from('announcements')
        .select(
          `*,
          profiles:author_id (
            full_name,
            avatar_url,
            role,
            nickname
          )`,
        )
        .order('created_at', { ascending: false })
        .range(from, to),
    { ttlMs: 10_000, allowStaleWhileRevalidate: true },
  );
};

const buildAnnouncementsWorkspace = async (): Promise<AnnouncementsWorkspaceData> => {
  const [{ data: auth }, roleState] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentUserRoleState(),
  ]);
  const currentUserId = auth.user?.id || '';
  const [hiddenIds, pageResult] = await Promise.all([
    currentUserId ? fetchHiddenAnnouncementIds(currentUserId) : Promise.resolve(new Set<string>()),
    queryAnnouncementPage(0, 7),
  ]);

  if (pageResult.error) {
    throw pageResult.error;
  }

  return {
    currentUserId,
    userRoles: roleState?.roles || ['resident'],
    hiddenAnnouncementIds: Array.from(hiddenIds),
    announcements: (pageResult.data || []) as AnnouncementWorkspaceRow[],
  };
};

export const getAnnouncementsWorkspace = async (options?: { force?: boolean }): Promise<AnnouncementsWorkspaceData> => {
  const force = Boolean(options?.force);
  if (!force && announcementsWorkspaceCache) {
    return announcementsWorkspaceCache;
  }
  if (!force && announcementsWorkspacePromise) {
    return announcementsWorkspacePromise;
  }

  announcementsWorkspacePromise = buildAnnouncementsWorkspace()
    .then((workspace) => {
      announcementsWorkspaceCache = workspace;
      return workspace;
    })
    .finally(() => {
      announcementsWorkspacePromise = null;
    });

  return announcementsWorkspacePromise;
};

export const getCachedAnnouncementsWorkspace = (): AnnouncementsWorkspaceData | null => announcementsWorkspaceCache;

export const preloadAnnouncementsWorkspace = async (): Promise<void> => {
  await getAnnouncementsWorkspace();
};
