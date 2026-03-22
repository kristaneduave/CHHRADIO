import { supabase } from './supabase';
import { NewsfeedNotification, NotificationSeverity, Screen } from '../types';
import { fetchWithCache, invalidateCacheByPrefix } from '../utils/requestCache';

interface CachedNewsfeedData {
  notifications: NewsfeedNotification[];
  unreadCount: number;
  hasMore: boolean;
  cursor?: string;
}

const cachedNewsfeedByUser = new Map<string, CachedNewsfeedData>();

const formatTimeAgo = (iso: string): string => {
  const ts = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const mapRowToNotification = (row: any, actorName?: string): NewsfeedNotification => ({
  id: row.notification_id,
  title: row.notifications?.title || 'Notification',
  message: row.notifications?.message || '',
  severity: (row.notifications?.severity || 'info') as NotificationSeverity,
  type: row.notifications?.type || 'system',
  time: formatTimeAgo(row.created_at || row.notifications?.created_at),
  createdAt: row.created_at || row.notifications?.created_at,
  read: !!row.read_at,
  actorName: actorName || 'Hospital Staff',
  linkScreen: (row.notifications?.link_screen || null) as Screen | null,
  linkEntityId: row.notifications?.link_entity_id || null,
});

export const fetchNotificationsPage = async (
  userId: string,
  limit = 20,
  beforeCreatedAt?: string,
): Promise<{ data: NewsfeedNotification[]; hasMore: boolean }> => {
  const pageKey = beforeCreatedAt || 'latest';
  const { data, error } = await fetchWithCache(
    `newsfeed:notifications:${userId}:${limit}:${pageKey}`,
    () => {
      let query = supabase
        .from('notification_recipients')
        .select(
          `
            id,
            notification_id,
            user_id,
            read_at,
            created_at,
            notifications:notification_id (
              id,
              title,
              message,
              severity,
              type,
              created_by,
              link_screen,
              link_entity_id,
              created_at
            )
          `,
        )
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (beforeCreatedAt) {
        query = query.lt('created_at', beforeCreatedAt);
      }

      return query;
    },
    { ttlMs: 5_000, allowStaleWhileRevalidate: true },
  );
  if (error) throw error;

  const creatorIds = Array.from(
    new Set(
      (data || [])
        .map((row: any) => row.notifications?.created_by as string | null)
        .filter((id: string | null): id is string => Boolean(id)),
    ),
  );

  let actorById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, nickname')
      .in('id', creatorIds);

    if (!profilesError && profiles) {
      actorById = new Map(
        profiles.map((profile: any) => [
          profile.id as string,
          (profile.nickname as string | null) || (profile.full_name as string | null) || 'Hospital Staff',
        ]),
      );
    }
  }

  const rows = (data || []).map((row: any) => {
    const createdBy = row.notifications?.created_by as string | null;
    const actorName = createdBy ? actorById.get(createdBy) || (createdBy === userId ? 'You' : 'Hospital Staff') : 'Hospital Staff';
    return mapRowToNotification(row, actorName);
  });
  const hasMore = rows.length > limit;
  const page = {
    data: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
  if (!beforeCreatedAt) {
    cachedNewsfeedByUser.set(userId, {
      notifications: page.data,
      unreadCount: page.data.filter((item) => !item.read).length,
      hasMore: page.hasMore,
      cursor: page.data.length ? page.data[page.data.length - 1].createdAt : undefined,
    });
  }
  return page;
};

export const markNotificationRead = async (notificationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const hideNotificationForUser = async (notificationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ archived_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .is('archived_at', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const hideAllNotificationsForUser = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ archived_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('archived_at', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const unhideNotificationForUser = async (notificationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ archived_at: null })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .not('archived_at', 'is', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const unhideAllNotificationsForUser = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ archived_at: null })
    .eq('user_id', userId)
    .not('archived_at', 'is', null);

  if (error) throw error;
  invalidateCacheByPrefix(`newsfeed:notifications:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:hidden:${userId}:`);
  invalidateCacheByPrefix(`newsfeed:unread-count:${userId}`);
};

export const fetchHiddenNotificationsForUser = async (
  userId: string,
  limit = 50,
): Promise<NewsfeedNotification[]> => {
  if (!userId) return [];

  const { data, error } = await fetchWithCache(
    `newsfeed:hidden:${userId}:${limit}`,
    () =>
      supabase
        .from('notification_recipients')
        .select(
          `
            id,
            notification_id,
            user_id,
            read_at,
            created_at,
            archived_at,
            notifications:notification_id (
              id,
              title,
              message,
              severity,
              type,
              created_by,
              link_screen,
              link_entity_id,
              created_at
            )
          `,
        )
        .eq('user_id', userId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .limit(limit),
    { ttlMs: 10_000, allowStaleWhileRevalidate: true },
  );

  if (error) throw error;

  const creatorIds = Array.from(
    new Set(
      (data || [])
        .map((row: any) => row.notifications?.created_by as string | null)
        .filter((id: string | null): id is string => Boolean(id)),
    ),
  );

  let actorById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, nickname')
      .in('id', creatorIds);

    if (!profilesError && profiles) {
      actorById = new Map(
        profiles.map((profile: any) => [
          profile.id as string,
          (profile.nickname as string | null) || (profile.full_name as string | null) || 'Hospital Staff',
        ]),
      );
    }
  }

  return (data || []).map((row: any) => {
    const createdBy = row.notifications?.created_by as string | null;
    const actorName = createdBy ? actorById.get(createdBy) || (createdBy === userId ? 'You' : 'Hospital Staff') : 'Hospital Staff';
    return mapRowToNotification(row, actorName);
  });
};

export const fetchUnreadNotificationsCount = async (userId: string): Promise<number> => {
  const { count, error } = await fetchWithCache(
    `newsfeed:unread-count:${userId}`,
    () =>
      supabase
        .from('notification_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('archived_at', null)
        .is('read_at', null),
    { ttlMs: 4_000, allowStaleWhileRevalidate: true },
  );

  if (error) throw error;
  return count || 0;
};

export const preloadNewsfeedData = async (userId: string): Promise<void> => {
  if (!userId) return;
  const [page, unreadCount] = await Promise.all([
    fetchNotificationsPage(userId, 20),
    fetchUnreadNotificationsCount(userId),
  ]);
  cachedNewsfeedByUser.set(userId, {
    notifications: page.data,
    unreadCount,
    hasMore: page.hasMore,
    cursor: page.data.length ? page.data[page.data.length - 1].createdAt : undefined,
  });
};

export const getCachedNewsfeedData = (userId: string): CachedNewsfeedData | null =>
  cachedNewsfeedByUser.get(userId) || null;

export const subscribeToNotifications = (
  userId: string,
  onRefreshRequested: () => void,
) => {
  const channel = supabase
    .channel(`newsfeed-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notification_recipients',
        filter: `user_id=eq.${userId}`,
      },
      () => onRefreshRequested(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const createSystemNotification = async (params: {
  actorUserId?: string | null;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  linkScreen?: Screen;
  linkEntityId?: string;
  recipientUserIds: string[];
}): Promise<void> => {
  // Always include the actor to guarantee they can see their own emitted notification,
  // even when profile-based recipient lookup is incomplete.
  const baseRecipients = [...params.recipientUserIds.filter(Boolean), params.actorUserId].filter(Boolean);
  const uniqueRecipients = Array.from(new Set(baseRecipients));
  if (uniqueRecipients.length === 0) return;

  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .insert({
      type: params.type,
      severity: params.severity || 'info',
      title: params.title,
      message: params.message,
      link_screen: params.linkScreen || null,
      link_entity_id: params.linkEntityId || null,
      created_by: params.actorUserId || null,
    })
    .select('id')
    .single();

  if (notifError) throw notifError;

  const { error: recipientsError } = await supabase.from('notification_recipients').insert(
    uniqueRecipients.map((uid) => ({
      notification_id: notification.id,
      user_id: uid,
    })),
  );

  if (recipientsError) throw recipientsError;
  uniqueRecipients.forEach((uid) => {
    invalidateCacheByPrefix(`newsfeed:notifications:${uid}:`);
    invalidateCacheByPrefix(`newsfeed:hidden:${uid}:`);
    invalidateCacheByPrefix(`newsfeed:unread-count:${uid}`);
  });
};

export const fetchRecipientUserIdsByRoles = async (roles: string[]): Promise<string[]> => {
  if (!roles.length) return [];
  const { data, error } = await supabase.from('profiles').select('id').in('role', roles);
  if (error) throw error;
  return (data || []).map((row: any) => row.id);
};

export const fetchAllRecipientUserIds = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('profiles').select('id');
  if (!error && data && data.length > 0) {
    return data.map((row: any) => row.id);
  }

  // Fallback for stricter profile RLS setups: at least target the current actor.
  const { data: authData } = await supabase.auth.getUser();
  const selfId = authData.user?.id;
  return selfId ? [selfId] : [];
};

export const sendSummonNotification = async (
  senderId: string,
  senderName: string,
  targetUserId: string,
  floorName: string,
): Promise<void> => {
  await createSystemNotification({
    actorUserId: senderId,
    type: 'SUMMON_MAP',
    severity: 'info',
    title: 'Map Request',
    message: `${senderName} is requesting your presence at ${floorName}`,
    linkScreen: 'anatomy',
    recipientUserIds: [targetUserId],
  });
};
