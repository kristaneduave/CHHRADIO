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

export const hideAnnouncementForUser = async (announcementId: string): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('announcement_user_hidden').upsert(
    {
      announcement_id: announcementId,
      user_id: user.id,
    },
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
  );

  if (error) throw error;
};

export const unhideAnnouncementForUser = async (announcementId: string): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('announcement_user_hidden')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', user.id);

  if (error) throw error;
};

export const unhideAllAnnouncementsForUser = async (): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('announcement_user_hidden').delete().eq('user_id', user.id);
  if (error) throw error;
};

export const fetchHiddenAnnouncementIds = async (userId: string): Promise<Set<string>> => {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('announcement_user_hidden')
    .select('announcement_id')
    .eq('user_id', userId);
  if (error) throw error;

  return new Set((data || []).map((row: any) => row.announcement_id as string));
};

export const isAnnouncementHiddenForUser = async (announcementId: string): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('announcement_user_hidden')
    .select('id')
    .eq('announcement_id', announcementId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
};

export const fetchHiddenAnnouncements = async (userId: string, limit = 50): Promise<Announcement[]> => {
  if (!userId) return [];

  const { data: hiddenRows, error: hiddenError } = await supabase
    .from('announcement_user_hidden')
    .select('announcement_id, hidden_at')
    .eq('user_id', userId)
    .order('hidden_at', { ascending: false })
    .limit(limit);

  if (hiddenError) throw hiddenError;
  const ids = (hiddenRows || []).map((row: any) => row.announcement_id as string).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: announcements, error: announcementError } = await supabase
    .from('announcements')
    .select(
      `
        *,
        profiles:author_id (
          full_name,
          avatar_url,
          role,
          nickname
        )
      `,
    )
    .in('id', ids);

  if (announcementError) throw announcementError;

  const byId = new Map<string, any>((announcements || []).map((row: any) => [row.id as string, row]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((item: any) => mapAnnouncementRow(item));
};
