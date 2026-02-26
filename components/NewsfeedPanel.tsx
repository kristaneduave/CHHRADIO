import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { Activity, NewsfeedNotification, NewsfeedOnlineUser, Screen } from '../types';
import { fetchRecentActivity } from '../services/activityService';
import { fetchOnlineProfiles, subscribeToOnlineUsers } from '../services/newsfeedPresenceService';
import {
  fetchNotificationsPage,
  hideAllNotificationsForUser,
  hideNotificationForUser,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/newsfeedService';
import { isAnnouncementHiddenForUser } from '../services/announcementVisibilityService';
import { toastInfo } from '../utils/toast';
import LoadingButton from './LoadingButton';
import LoadingState from './LoadingState';

interface NewsfeedPanelProps {
  variant: 'screen' | 'modal';
  onClose?: () => void;
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
}

const NewsfeedPanel: React.FC<NewsfeedPanelProps> = ({ variant, onClose, onNavigateToTarget }) => {
  const SNAPSHOT_STALE_MS = 60_000;
  const FEED_FILTER_KEY = 'chh_newsfeed_filter';
  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'announcements' | 'calendar' | 'cases' | 'system'>(() => {
    if (typeof window === 'undefined') return 'unread';
    const saved = window.localStorage.getItem(FEED_FILTER_KEY);
    if (saved === 'all' || saved === 'unread' || saved === 'announcements' || saved === 'calendar' || saved === 'cases' || saved === 'system') {
      return saved;
    }
    return 'unread';
  });
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState<NewsfeedNotification[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [hidingNotificationId, setHidingNotificationId] = useState<string | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<'read' | 'hide' | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<NewsfeedOnlineUser[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const isModal = variant === 'modal';
  const listPadding = isModal ? 'p-4' : 'px-6';
  const onlineDisplayLimit = 12;
  const visibleOnlineUsers = onlineUsers.slice(0, onlineDisplayLimit);
  const hiddenOnlineUsers = Math.max(onlineUsers.length - onlineDisplayLimit, 0);
  const onlineCount = onlineUserIds.length;

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const filteredSortedNotifications = useMemo(() => {
    const matchesFilter = (notif: NewsfeedNotification): boolean => {
      if (notificationFilter === 'all') return true;
      if (notificationFilter === 'unread') return !notif.read;
      if (notificationFilter === 'announcements') {
        return notif.linkScreen === 'announcements' || notif.type.toLowerCase().includes('announcement');
      }
      if (notificationFilter === 'calendar') {
        const t = notif.type.toLowerCase();
        return notif.linkScreen === 'calendar' || t.includes('calendar') || t.includes('leave');
      }
      if (notificationFilter === 'cases') {
        const t = notif.type.toLowerCase();
        return notif.linkScreen === 'search' || notif.linkScreen === 'case-view' || t.includes('case');
      }
      return notif.linkScreen == null || notif.type.toLowerCase().includes('system');
    };

    const filtered = notifications.filter(matchesFilter);
    const sorted = [...filtered];
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [notifications, notificationFilter]);

  const formatNotificationType = (type: string): string =>
    (type || 'system')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatNotificationDate = (iso: string): string => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '--';
    const dateStr = parsed.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
    const timeStr = parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${dateStr} \u2022 ${timeStr}`;
  };

  const getActivityTypeLabel = (activity: Activity): string => {
    if (activity.icon === 'upload_file' || /case/i.test(activity.title)) return 'Case';
    if (activity.icon === 'edit' || /profile/i.test(activity.title)) return 'Profile';
    if (activity.icon === 'chat' || /chat/i.test(activity.title)) return 'Chat';
    return 'Activity';
  };

  const groupedActivities = useMemo(() => {
    const groups: Array<{ key: 'today' | 'yesterday' | 'earlier'; label: string; items: Activity[] }> = [
      { key: 'today', label: 'Today', items: [] },
      { key: 'yesterday', label: 'Yesterday', items: [] },
      { key: 'earlier', label: 'Earlier', items: [] },
    ];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    activities.forEach((activity) => {
      const parsed = activity.createdAt ? new Date(activity.createdAt) : null;
      const ts = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      if (!ts) {
        groups[2].items.push(activity);
        return;
      }
      if (ts >= todayStart) {
        groups[0].items.push(activity);
        return;
      }
      if (ts >= yesterdayStart) {
        groups[1].items.push(activity);
        return;
      }
      groups[2].items.push(activity);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [activities]);

  useEffect(() => {
    let cleanup = () => { };
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || '';
      setUserId(uid);
      if (!uid) return;

      await Promise.all([refreshNotifications(uid)]);
      cleanup = subscribeToNotifications(uid, () => {
        refreshNotifications(uid).catch((err) => console.error('Realtime refresh failed:', err));
      });
    };
    init();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    const poll = setInterval(() => {
      refreshNotifications(userId).catch((err) => console.error('Polling refresh failed:', err));
    }, 60000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeTab]);

  useEffect(() => {
    if (activeTab === 'activity' && userId) {
      loadActivity(userId);
    }
  }, [activeTab, userId]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let hydrateToken = 0;
    setLoadingOnline(true);
    setOnlineError(null);

    const unsubscribe = subscribeToOnlineUsers({
      currentUserId: userId,
      trackCurrentUser: false,
      onUsersChange: (ids) => {
        if (!mounted) return;
        const deduped = Array.from(new Set(ids));
        setOnlineUserIds(deduped);

        if (deduped.length === 0) {
          setOnlineUsers([]);
          setLoadingOnline(false);
          setOnlineError(null);
          return;
        }

        const currentToken = ++hydrateToken;
        fetchOnlineProfiles(deduped)
          .then((users) => {
            if (!mounted || currentToken !== hydrateToken) return;
            setOnlineUsers([...users].sort((a, b) => a.displayName.localeCompare(b.displayName)));
            setLoadingOnline(false);
            setOnlineError(null);
          })
          .catch((error) => {
            console.error('Failed to hydrate online users:', error);
            if (!mounted || currentToken !== hydrateToken) return;
            setOnlineUsers(
              deduped.map((id) => ({
                id,
                displayName: `User ${id.slice(0, 6)}`,
                avatarUrl: null,
              })),
            );
            setLoadingOnline(false);
            setOnlineError('Online status unavailable');
          });
      },
      onError: (message) => {
        if (!mounted) return;
        setOnlineError(message);
        setLoadingOnline(false);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_FILTER_KEY, notificationFilter);
  }, [notificationFilter]);

  const refreshNotifications = async (uid: string) => {
    try {
      setLoadingNotifications(true);
      const page = await fetchNotificationsPage(uid, 20);
      setNotifications(page.data);
      setHasMoreNotifications(page.hasMore);
      setCursor(page.data.length ? page.data[page.data.length - 1].createdAt : undefined);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const loadMoreNotifications = async () => {
    if (!userId || !cursor || !hasMoreNotifications) return;
    try {
      setLoadingMore(true);
      const page = await fetchNotificationsPage(userId, 20, cursor);
      const merged = [...notifications];
      const existing = new Set(merged.map((n) => n.id));
      page.data.forEach((n) => {
        if (!existing.has(n.id)) merged.push(n);
      });
      setNotifications(merged);
      setHasMoreNotifications(page.hasMore);
      setCursor(page.data.length ? page.data[page.data.length - 1].createdAt : cursor);
    } catch (error) {
      console.error('Error loading more notifications:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadActivity = async (uid: string) => {
    try {
      setLoadingActivity(true);
      const data = await fetchRecentActivity(uid, 50);
      setActivities(data);
    } catch (error) {
      console.error('Error loading activity log:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleNotificationClick = async (notif: NewsfeedNotification) => {
    const previous = notifications;
    if (!notif.read && userId) {
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      try {
        await markNotificationRead(notif.id, userId);
      } catch (error) {
        console.error('Failed to mark notification read:', error);
        setNotifications(previous);
      }
    }

    if (notif.linkScreen === 'announcements' && notif.linkEntityId) {
      try {
        const hidden = await isAnnouncementHiddenForUser(notif.linkEntityId);
        if (hidden) {
          toastInfo('News is hidden', 'Restore it in Profile > Hidden News.');
          return;
        }
      } catch (error) {
        console.error('Failed to verify announcement visibility:', error);
      }
    }

    if (notif.linkScreen && onNavigateToTarget) {
      onNavigateToTarget(notif.linkScreen, notif.linkEntityId);
      onClose?.();
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId || unreadCount === 0) return;
    const previous = notifications;
    setBulkActionLoading('read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead(userId);
    } catch (error) {
      console.error('Failed to mark all read:', error);
      setNotifications(previous);
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleHideAllNotifications = async () => {
    if (!userId || notifications.length === 0) return;
    const previous = notifications;
    setBulkActionLoading('hide');
    setNotifications([]);
    setHasMoreNotifications(false);
    setCursor(undefined);
    try {
      await hideAllNotificationsForUser(userId);
    } catch (error) {
      console.error('Failed to hide all notifications:', error);
      setNotifications(previous);
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleHideNotification = async (event: React.MouseEvent, notificationId: string) => {
    event.stopPropagation();
    if (!userId || hidingNotificationId === notificationId) return;

    const previous = notifications;
    setHidingNotificationId(notificationId);
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    try {
      await hideNotificationForUser(notificationId, userId);
    } catch (error) {
      console.error('Failed to hide notification:', error);
      setNotifications(previous);
    } finally {
      setHidingNotificationId(null);
    }
  };

  return (
    <>
      <div className={`${isModal ? 'p-4 border-b border-white/5 bg-surface' : 'px-6 pt-6 pb-2 bg-app/80 backdrop-blur-md'}`}>
        <div className="flex items-center justify-between min-h-[32px]">
          <h1 className={`${isModal ? 'text-xl' : 'text-3xl'} font-bold text-white`}>
            {isModal ? 'Notification Center' : 'Newsfeed'}
          </h1>
          {isModal && onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
              <span className="material-icons text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      <div className={isModal ? 'p-4 border-b border-white/5' : 'px-6 pt-2 pb-4'}>
        <div className="flex bg-black/40 p-1.5 rounded-[1.25rem] border border-white/5 backdrop-blur-md shadow-inner -mx-1.5">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition-all duration-300 ${activeTab === 'notifications' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
          >
            Notifications {unreadCount > 0 ? <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] leading-none text-white">{unreadCount}</span> : ''}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-3 text-[13px] font-bold rounded-xl transition-all duration-300 ${activeTab === 'activity' ? 'bg-primary text-white shadow-[0_4px_12px_rgba(13,162,231,0.3)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
          >
            Activity Log
          </button>
        </div>

        {activeTab === 'notifications' && (
          <div className="grid grid-cols-3 gap-2 mt-4 mb-2">
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 transition-all shadow-sm"
            >
              <span className="material-icons text-[14px]">tune</span>
              <span className="truncate">Filter: {notificationFilter === 'all' ? 'All' : notificationFilter}</span>
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || bulkActionLoading !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 transition-all shadow-sm disabled:opacity-50"
            >
              <span className="material-icons text-[14px]">drafts</span>
              <span className="truncate">Read All</span>
            </button>
            <button
              onClick={handleHideAllNotifications}
              disabled={notifications.length === 0 || bulkActionLoading !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 transition-all shadow-sm disabled:opacity-50"
            >
              <span className="material-icons text-[14px]">visibility_off</span>
              <span className="truncate">Hide All</span>
            </button>
          </div>
        )}
      </div>

      <div className={`${listPadding} ${isModal ? 'flex-1 overflow-y-auto' : ''} space-y-4`}>
        {activeTab === 'notifications' ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {loadingNotifications ? (
              <LoadingState title="Loading notifications..." compact />
            ) : filteredSortedNotifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <span className="material-icons text-4xl mb-2 opacity-50">notifications_off</span>
                <p className="text-sm">{notifications.length === 0 ? 'No notifications.' : 'No notifications match this filter.'}</p>
              </div>
            ) : (
              <>
                {filteredSortedNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-4 rounded-2xl backdrop-blur-md transition-all duration-300 relative group overflow-hidden ${notif.read
                      ? 'bg-white/[0.03] border border-white/5 opacity-80 hover:bg-white/[0.05]'
                      : 'bg-primary/[0.08] border border-primary/30 shadow-[0_4px_24px_-8px_rgba(13,162,231,0.25)] hover:bg-primary/[0.12]'
                      }`}
                  >
                    {/* Subtle glow effect for unread */}
                    {!notif.read && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none transform -translate-y-1/2 translate-x-1/2" />
                    )}
                    <div className="flex items-start gap-3 w-full z-10 relative">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner mt-0.5 ${notif.read ? 'bg-black/40 border border-white/5 text-primary-light opacity-80' : 'bg-primary/20 border border-primary/40 text-primary-light shadow-[0_0_15px_rgba(13,162,231,0.3)]'}`}>
                        <span className="material-icons text-xl">
                          {notif.type.toLowerCase().includes('calendar') || notif.type.toLowerCase().includes('leave') ? 'event' :
                            notif.type.toLowerCase().includes('case') ? 'folder_special' :
                              notif.type.toLowerCase().includes('announcement') ? 'campaign' :
                                'medical_information'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-2 min-w-0">
                            <h4 className={`text-[14px] sm:text-[15px] truncate tracking-tight ${notif.read ? 'font-medium text-slate-200' : 'font-bold text-white'}`}>
                              {formatNotificationType(notif.type)}
                            </h4>
                            {!notif.read && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] leading-none font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/35 shrink-0 mt-0.5">
                                New
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(event) => handleHideNotification(event, notif.id)}
                            disabled={hidingNotificationId === notif.id}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300 disabled:opacity-50 -mt-1 -mr-1"
                            aria-label="Hide notification"
                            title="Hide notification"
                          >
                            <span className="material-icons text-[14px]">visibility_off</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] sm:text-[12px] text-slate-400 truncate">by <span className="text-slate-300">{notif.actorName || 'Hospital Staff'}</span></span>
                          <span className={`text-[10px] sm:text-[11px] whitespace-nowrap font-medium uppercase tracking-wider ${notif.read ? 'text-slate-500' : 'text-primary-light/80'}`}>{formatNotificationDate(notif.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-slate-500">{filteredSortedNotifications.length} item(s)</span>
                  {hasMoreNotifications && (
                    <LoadingButton
                      onClick={loadMoreNotifications}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                      isLoading={loadingMore}
                      loadingText="Loading..."
                    >
                      Load more
                    </LoadingButton>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Who's Online
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                  {onlineCount}
                </span>
              </div>

              {loadingOnline ? (
                <p className="text-xs text-slate-400">Checking online status...</p>
              ) : onlineCount > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {visibleOnlineUsers.map((user) => {
                    const initial = user.displayName.trim().charAt(0).toUpperCase() || 'U';
                    return (
                      <div
                        key={user.id}
                        className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 pr-3 pl-1 py-1 shadow-sm"
                        aria-label={`${user.displayName} online`}
                      >
                        <div className="relative">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.displayName} className="h-7 w-7 rounded-full object-cover border border-white/20" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/80 text-[11px] font-bold text-slate-200 border border-white/20">
                              {initial}
                            </span>
                          )}
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#1c1c1e]" />
                        </div>
                        <span className="text-[13px] font-medium text-slate-200">{user.displayName.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                  {hiddenOnlineUsers > 0 && (
                    <span className="flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-bold text-slate-400 shadow-sm">
                      +{hiddenOnlineUsers}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No one is online right now.</p>
              )}

              {onlineError && (
                <p className="mt-2 text-xs text-rose-300">{onlineError}</p>
              )}
            </div>

            {loadingActivity ? (
              <LoadingState title="Loading history..." compact />
            ) : activities.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <span className="material-icons text-4xl mb-2 opacity-50">history</span>
                <p className="text-sm">No recent activity found.</p>
              </div>
            ) : (
              groupedActivities.map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{group.label}</p>
                  {group.items.map((activity, index) => (
                    <div key={`${activity.id}-${index}`} className="group relative overflow-hidden backdrop-blur-md bg-white/[0.02] hover:bg-white/[0.04] p-4 rounded-2xl flex items-start gap-4 border border-white/5 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent -translate-x-full group-hover:translate-x-full duration-1000 ease-in-out pointer-events-none" />

                      <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-inner ${activity.colorClass?.includes('primary') || activity.colorClass?.includes('blue')
                        ? 'bg-primary/10 border-primary/30 text-primary-light shadow-[0_0_15px_rgba(13,162,231,0.15)]'
                        : activity.colorClass?.includes('green') || activity.colorClass?.includes('emerald')
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : activity.colorClass?.includes('amber') || activity.colorClass?.includes('yellow') || activity.colorClass?.includes('orange')
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}>
                        <span className="material-icons text-[22px]">{activity.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5 relative z-10">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">
                            {getActivityTypeLabel(activity)}
                          </span>
                          <span className="text-[11px] font-medium tracking-wide uppercase text-slate-500 whitespace-nowrap">{activity.time}</span>
                        </div>
                        <h4 className="text-[15px] font-bold text-slate-100 leading-tight tracking-tight">{activity.title}</h4>
                        <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{activity.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {isFilterSheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          onClick={() => setIsFilterSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Notification filters"
        >
          <div
            className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-2xl border border-border-default/70 bg-surface p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Filter notifications</h3>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close filter sheet"
              >
                <span className="material-icons text-[16px]">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread' },
                { key: 'announcements', label: 'News' },
                { key: 'calendar', label: 'Calendar' },
                { key: 'cases', label: 'Cases' },
                { key: 'system', label: 'System' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setNotificationFilter(item.key as typeof notificationFilter);
                    setIsFilterSheetOpen(false);
                  }}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${notificationFilter === item.key
                    ? 'border-primary/45 bg-primary/15 text-primary-light'
                    : 'border-border-default/70 bg-black/15 text-slate-300'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewsfeedPanel;

