import { supabase } from './supabase';
import { fetchHiddenAnnouncements } from './announcementVisibilityService';
import { fetchHiddenNotificationsForUser } from './newsfeedService';
import { fetchWithCache } from '../utils/requestCache';

export const fetchProfileRecord = async (userId: string): Promise<any | null> => {
  if (!userId) return null;
  return fetchWithCache(
    `profile-home:profile:${userId}`,
    async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    { ttlMs: 30_000, allowStaleWhileRevalidate: true },
  );
};

export const fetchMyCasesForProfileHome = async (userId: string): Promise<any[]> => {
  if (!userId) return [];
  return fetchWithCache(
    `profile-home:cases:${userId}`,
    async () => {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    { ttlMs: 20_000, allowStaleWhileRevalidate: true },
  );
};

export const fetchHiddenAnnouncementsForProfileHome = async (userId: string, limit = 50) => {
  if (!userId) return [];
  return fetchWithCache(
    `profile-home:hidden-announcements:${userId}:${limit}`,
    () => fetchHiddenAnnouncements(userId, limit),
    { ttlMs: 20_000, allowStaleWhileRevalidate: true },
  );
};

export const fetchProfileNotePreview = async (userId: string): Promise<{ id: string; content: string; updated_at: string } | null> => {
  if (!userId) return null;
  return fetchWithCache(
    `profile-home:note:${userId}`,
    async () => {
      const { data, error } = await supabase
        .from('profile_private_notes')
        .select('id,content,updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: String(data.id),
        content: String(data.content || ''),
        updated_at: String(data.updated_at),
      };
    },
    { ttlMs: 20_000, allowStaleWhileRevalidate: true },
  );
};

export const preloadProfileHome = async (userId: string): Promise<void> => {
  if (!userId) return;
  await Promise.all([
    fetchProfileRecord(userId),
    fetchMyCasesForProfileHome(userId),
    fetchHiddenAnnouncementsForProfileHome(userId, 50),
    fetchHiddenNotificationsForUser(userId, 50),
    fetchProfileNotePreview(userId),
  ]);
};
