import { Announcement } from '../types';
import { supabase } from './supabase';
import { getRoleLabel } from '../utils/roles';

const mapAnnouncementRow = (item: any): Announcement => ({
  id: item.id,
  title: item.title,
  summary: item.content.length > 200 ? item.content.substring(0, 200) + '...' : item.content,
  content: item.content,
  createdAt: item.created_at,
  author: item.profiles?.nickname || item.profiles?.full_name || 'Hospital Staff',
  authorFullName: item.profiles?.full_name || 'Hospital Staff',
  authorNickname: item.profiles?.nickname,
  author_id: item.author_id,
  authorAvatar: item.profiles?.avatar_url,
  authorTitle: getRoleLabel(item.profiles?.role),
  date: new Date(item.created_at).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  category: item.category,
  is_pinned: Boolean(item.is_pinned ?? item.pinned ?? false),
  is_important: Boolean(item.is_important ?? false),
  pinned_at: item.pinned_at || null,
  imageUrl: item.image_url,
  views: item.views || 0,
  attachments: item.attachments || [],
  externalLink: item.external_link,
  links: item.links || [],
  icon: item.icon,
});

export const saveAnnouncementForUser = async (announcementId: string): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('announcement_user_saved').upsert(
    { announcement_id: announcementId, user_id: user.id },
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
  );
  if (error) throw error;
};

export const unsaveAnnouncementForUser = async (announcementId: string): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('announcement_user_saved')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', user.id);
  if (error) throw error;
};

export const fetchSavedAnnouncementIds = async (userId: string): Promise<Set<string>> => {
  if (!userId) return new Set<string>();
  const { data, error } = await supabase.from('announcement_user_saved').select('announcement_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.announcement_id as string));
};

export const fetchSavedAnnouncements = async (userId: string, limit = 50): Promise<Announcement[]> => {
  if (!userId) return [];

  const { data: savedRows, error: savedError } = await supabase
    .from('announcement_user_saved')
    .select('announcement_id, saved_at')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
    .limit(limit);
  if (savedError) throw savedError;

  const ids = (savedRows || []).map((row: any) => row.announcement_id as string).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: announcements, error: announcementError } = await supabase
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
    .in('id', ids);
  if (announcementError) throw announcementError;

  const byId = new Map<string, any>((announcements || []).map((row: any) => [row.id as string, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((item: any) => mapAnnouncementRow(item));
};
