import { supabase } from './supabase';
import { NewsfeedNotification, NotificationSeverity, Screen } from '../types';

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

const mapRowToNotification = (row: any): NewsfeedNotification => ({
  id: row.notification_id,
  title: row.notifications?.title || 'Notification',
  message: row.notifications?.message || '',
  severity: (row.notifications?.severity || 'info') as NotificationSeverity,
  type: row.notifications?.type || 'system',
  time: formatTimeAgo(row.created_at || row.notifications?.created_at),
  createdAt: row.created_at || row.notifications?.created_at,
  read: !!row.read_at,
  linkScreen: (row.notifications?.link_screen || null) as Screen | null,
  linkEntityId: row.notifications?.link_entity_id || null,
});

export const fetchNotificationsPage = async (
  userId: string,
  limit = 20,
  beforeCreatedAt?: string,
): Promise<{ data: NewsfeedNotification[]; hasMore: boolean }> => {
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

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map(mapRowToNotification);
  const hasMore = rows.length > limit;
  return {
    data: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
};

export const markNotificationRead = async (notificationId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
};

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
  actorUserId: string;
  type: string;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  linkScreen?: Screen;
  linkEntityId?: string;
  recipientUserIds: string[];
}): Promise<void> => {
  const baseRecipients = params.recipientUserIds.filter(Boolean);
  if (baseRecipients.length === 0 && params.actorUserId) {
    baseRecipients.push(params.actorUserId);
  }
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
