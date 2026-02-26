import { supabase } from './supabase';
import { NewsfeedOnlineUser, UserRole } from '../types';

interface PresencePayload {
  user_id: string;
  ts: string;
}

interface SubscribeToOnlineUsersParams {
  currentUserId: string;
  onUsersChange: (userIds: string[]) => void;
  onError?: (message: string) => void;
  trackCurrentUser?: boolean;
  includeCurrentUser?: boolean;
}

const buildFallbackName = (id: string): string => `User ${id.slice(0, 6)}`;

interface CreateAppPresenceTrackerParams {
  currentUserId: string;
  onError?: (message: string) => void;
}

export interface AppPresenceTracker {
  start: () => void;
  setVisible: (visible: boolean) => void;
  stop: () => void;
}

export const createAppPresenceTracker = ({
  currentUserId,
  onError,
}: CreateAppPresenceTrackerParams): AppPresenceTracker => {
  const channel = supabase.channel('newsfeed-online-presence', {
    config: {
      presence: { key: currentUserId },
    },
  });

  let subscribed = false;
  let started = false;
  let stopped = false;
  let isVisible = true;
  let isTracked = false;

  const applyTrackingState = async () => {
    if (!subscribed || stopped) return;
    try {
      if (isVisible && !isTracked) {
        await channel.track({ user_id: currentUserId, ts: new Date().toISOString() });
        isTracked = true;
      } else if (!isVisible && isTracked) {
        await channel.untrack();
        isTracked = false;
      }
    } catch (error) {
      console.error('Failed to update app-wide online presence:', error);
      onError?.('Online status unavailable');
    }
  };

  return {
    start: () => {
      if (started || stopped) return;
      started = true;
      channel.subscribe((status) => {
        if (stopped) return;
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          void applyTrackingState();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onError?.('Online status unavailable');
        }
      });
    },
    setVisible: (visible: boolean) => {
      isVisible = visible;
      void applyTrackingState();
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (subscribed && isTracked) {
        void channel.untrack();
      }
      void supabase.removeChannel(channel);
    },
  };
};

export const subscribeToOnlineUsers = ({
  currentUserId,
  onUsersChange,
  onError,
  trackCurrentUser = true,
  includeCurrentUser = false,
}: SubscribeToOnlineUsersParams): (() => void) => {
  const channel = supabase.channel('newsfeed-online-presence', {
    config: {
      presence: { key: currentUserId },
    },
  });

  const emitUsers = () => {
    const presenceState = channel.presenceState<PresencePayload>();
    const nextIds = Array.from(
      new Set(
        Object.values(presenceState)
          .flat()
          .map((entry) => entry.user_id)
          .filter((id) => Boolean(id) && (includeCurrentUser || id !== currentUserId)),
      ),
    );
    onUsersChange(nextIds);
  };

  channel
    .on('presence', { event: 'sync' }, emitUsers)
    .on('presence', { event: 'join' }, emitUsers)
    .on('presence', { event: 'leave' }, emitUsers)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && trackCurrentUser) {
        try {
          await channel.track({ user_id: currentUserId, ts: new Date().toISOString() });
        } catch (error) {
          console.error('Failed to track online presence:', error);
          onError?.('Online status unavailable');
        }
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.('Online status unavailable');
      }
    });

  return () => {
    if (trackCurrentUser) {
      void channel.untrack();
    }
    void supabase.removeChannel(channel);
  };
};

export const fetchOnlineProfiles = async (userIds: string[]): Promise<NewsfeedOnlineUser[]> => {
  if (!userIds.length) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, nickname, avatar_url, role')
    .in('id', userIds);

  if (error) throw error;

  const profileById = new Map(
    (data || []).map((profile: any) => [
      profile.id,
      {
        id: profile.id as string,
        displayName:
          (profile.nickname as string | null) ||
          (profile.full_name as string | null) ||
          buildFallbackName(profile.id as string),
        avatarUrl: (profile.avatar_url as string | null) || null,
        role: (profile.role as UserRole | undefined) || undefined,
      } satisfies NewsfeedOnlineUser,
    ]),
  );

  return userIds.map((id) => profileById.get(id) || { id, displayName: buildFallbackName(id), avatarUrl: null });
};
