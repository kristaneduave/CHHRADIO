import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { Activity, DashboardSnapshotData, NewsfeedNotification, NewsfeedOnlineUser, Screen } from '../types';
import { fetchRecentActivity } from '../services/activityService';
import {
  fetchNotificationsPage,
  hideAllNotificationsForUser,
  hideNotificationForUser,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/newsfeedService';
import { fetchOnlineProfiles, subscribeToOnlineUsers } from '../services/newsfeedPresenceService';
import {
  fetchDashboardSnapshot,
  markSnapshotSectionSeen,
} from '../services/dashboardSnapshotService';
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
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<NewsfeedOnlineUser[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineExpanded, setOnlineExpanded] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [snapshotData, setSnapshotData] = useState<DashboardSnapshotData | null>(null);
  const [snapshotErrors, setSnapshotErrors] = useState<
    Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'auth', string>>
  >({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotLastFetchedAt, setSnapshotLastFetchedAt] = useState(0);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [todayExamCount, setTodayExamCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [hidingNotificationId, setHidingNotificationId] = useState<string | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<'read' | 'hide' | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const isModal = variant === 'modal';
  const listPadding = isModal ? 'p-4' : 'px-6';

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const snapshotHasLeave = (snapshotData?.leaveToday.length || 0) > 0;
  const snapshotHasEvents = todayEventCount > 0;
  const snapshotHasExams = todayExamCount > 0;
  const snapshotHasCards = snapshotHasLeave || snapshotHasEvents || snapshotHasExams;
  const snapshotHasAnySectionError = Boolean(snapshotErrors.calendar || snapshotErrors.leaveToday || snapshotErrors.auth);
  const onlineCount = onlineUserIds.length;
  const onlineDisplayLimit = 12;
  const visibleOnlineUsers = onlineUsers.slice(0, onlineDisplayLimit);
  const hiddenOnlineUsers = Math.max(onlineUsers.length - onlineDisplayLimit, 0);
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
    return parsed.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
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
    let cleanup = () => {};
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || '';
      setUserId(uid);
      if (!uid) return;

      await Promise.all([refreshNotifications(uid), refreshSnapshot(uid)]);
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
      if (activeTab === 'notifications') {
        refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));
      }
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
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FEED_FILTER_KEY, notificationFilter);
  }, [notificationFilter]);

  useEffect(() => {
    if (activeTab !== 'notifications' || !userId) return;
    const isStale = !snapshotLastFetchedAt || Date.now() - snapshotLastFetchedAt > SNAPSHOT_STALE_MS;
    if (isStale) {
      refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let hydrateToken = 0;
    setLoadingOnline(true);
    setOnlineError(null);

    const unsubscribe = subscribeToOnlineUsers({
      currentUserId: userId,
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

  const refreshSnapshot = async (uid: string) => {
    if (!uid) return;
    try {
      setSnapshotLoading(true);
      const [{ data, sectionErrors }, todayEventsResult] = await Promise.all([
        fetchDashboardSnapshot(),
        (() => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          return supabase
            .from('events')
            .select('id,event_type,start_time,end_time')
            .lte('start_time', end.toISOString())
            .gte('end_time', start.toISOString());
        })(),
      ]);
      setSnapshotData(data);
      const mergedErrors: Partial<Record<'announcements' | 'cases' | 'calendar' | 'leaveToday' | 'auth', string>> = {
        auth: sectionErrors.auth,
        leaveToday: sectionErrors.leaveToday,
      };
      if (todayEventsResult.error) {
        mergedErrors.calendar = mergedErrors.calendar || 'Unable to load today events.';
        setTodayEventCount(0);
        setTodayExamCount(0);
      } else {
        const rows = todayEventsResult.data || [];
        const exams = rows.filter((row: any) => String(row.event_type || '').toLowerCase() === 'exam').length;
        const nonLeaveNonExam = rows.filter((row: any) => {
          const type = String(row.event_type || '').toLowerCase();
          return type !== 'leave' && type !== 'exam';
        }).length;
        setTodayExamCount(exams);
        setTodayEventCount(nonLeaveNonExam);
      }
      setSnapshotErrors(mergedErrors);
      setSnapshotLastFetchedAt(Date.now());
    } catch (error) {
      console.error('Error loading today snapshot:', error);
      setSnapshotErrors((prev) => ({ ...prev, auth: 'Unable to load snapshot.' }));
    } finally {
      setSnapshotLoading(false);
    }
  };

  const navigateFromSnapshot = (screen: Screen, section: 'announcements' | 'cases' | 'calendar') => {
    markSnapshotSectionSeen(section);
    refreshSnapshot(userId).catch((err) => console.error('Snapshot refresh failed:', err));
    if (!onNavigateToTarget) return;
    onNavigateToTarget(screen, null);
    if (isModal) onClose?.();
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
      <div className={`${isModal ? 'p-4 border-b border-white/5 bg-surface' : 'px-6 pt-12 pb-6 bg-app/80 backdrop-blur-md sticky top-0 z-20'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${isModal ? 'text-lg' : 'text-2xl'} font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400`}>
              {isModal ? 'Notification Center' : 'Newsfeed'}
            </h1>
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
              <span className="material-icons text-sm">close</span>
            </button>
          )}
        </div>

        {(onlineCount > 0 || loadingOnline || Boolean(onlineError)) && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onlineCount > 0 && setOnlineExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors"
            >
              <span className="uppercase tracking-[0.1em]">Online now</span>
              <span>|</span>
              <span>{onlineCount}</span>
              {onlineCount > 0 && (
                <span className="material-icons text-[14px]">
                  {onlineExpanded ? 'expand_less' : 'expand_more'}
                </span>
              )}
            </button>

            {onlineExpanded && onlineCount > 0 && (
              <div className="mt-2 overflow-x-auto">
                <div className="inline-flex items-center gap-1.5">
                  {visibleOnlineUsers.map((user) => {
                    const initial = user.displayName.trim().charAt(0).toUpperCase() || 'U';
                    return (
                      <div
                        key={user.id}
                        className="inline-flex max-w-[8.5rem] items-center gap-1.5 rounded-full border border-border-default/70 bg-black/20 px-2 py-1"
                        aria-label={`${user.displayName} online`}
                      >
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="h-5 w-5 rounded-full border border-border-default/70 object-cover"
                          />
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-default/70 bg-slate-700/60 text-[9px] font-semibold text-slate-200">
                            {initial}
                          </span>
                        )}
                        <span className="truncate text-[11px] text-slate-300">{user.displayName}</span>
                      </div>
                    );
                  })}
                  {hiddenOnlineUsers > 0 && (
                    <span className="inline-flex items-center rounded-full border border-border-default/70 bg-black/20 px-2 py-1 text-[11px] text-slate-400">
                      +{hiddenOnlineUsers}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={isModal ? 'p-4 border-b border-white/5' : 'px-6 py-4'}>
        {activeTab === 'notifications' && (snapshotLoading || snapshotHasCards) && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Today Snapshot</h3>
              <button
                onClick={() => refreshSnapshot(userId)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                aria-label="Refresh today snapshot"
              >
                <span className="material-icons text-sm">refresh</span>
              </button>
            </div>

            {snapshotLoading ? (
              <LoadingState title="Loading updates..." compact />
            ) : (
              <div className="space-y-1.5">
                {todayEventCount > 0 && (
                  <button
                    onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                    disabled={!onNavigateToTarget}
                    className="w-full text-left rounded-lg border border-white/8 bg-black/10 px-3 py-2 transition hover:bg-white/5 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <p className="text-[11px] text-slate-200">Events Today: {todayEventCount}</p>
                  </button>
                )}

                {todayExamCount > 0 && (
                  <button
                    onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                    disabled={!onNavigateToTarget}
                    className="w-full text-left rounded-lg border border-white/8 bg-black/10 px-3 py-2 transition hover:bg-white/5 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <p className="text-[11px] text-slate-200">Exams Today: {todayExamCount}</p>
                  </button>
                )}

                {snapshotHasLeave && (
                  <button
                    onClick={() => navigateFromSnapshot('calendar', 'calendar')}
                    disabled={!onNavigateToTarget}
                    className="w-full text-left rounded-lg border border-white/8 bg-black/10 px-3 py-2 transition hover:bg-white/5 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <p className="text-[11px] text-slate-200">
                      On Leave Today: {snapshotData?.leaveToday.map((entry) => entry.name).join(', ')}
                    </p>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'notifications' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'activity' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Activity Log
          </button>
        </div>

        {activeTab === 'notifications' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border-default/70 bg-black/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300 transition-colors hover:text-white"
            >
              <span className="material-icons text-[13px]">tune</span>
              Filter: {notificationFilter}
            </button>
            <div className="relative">
              <button
                onClick={() => setBulkMenuOpen((prev) => !prev)}
                disabled={notifications.length === 0 || bulkActionLoading !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-default/70 bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                aria-label="Open notification bulk actions"
              >
                <span className="material-icons text-[13px]">done_all</span>
                Actions
                <span className="material-icons text-[12px]">{bulkMenuOpen ? 'expand_less' : 'expand_more'}</span>
              </button>

              {bulkMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-lg border border-border-default/70 bg-surface p-1.5 shadow-xl">
                  <button
                    onClick={() => {
                      setBulkMenuOpen(false);
                      handleMarkAllRead();
                    }}
                    disabled={unreadCount === 0 || bulkActionLoading !== null}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[11px] text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span>Read all</span>
                    <span className="material-icons text-[13px]">drafts</span>
                  </button>
                  <button
                    onClick={() => {
                      setBulkMenuOpen(false);
                      handleHideAllNotifications();
                    }}
                    disabled={notifications.length === 0 || bulkActionLoading !== null}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-[11px] text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span>Hide all</span>
                    <span className="material-icons text-[13px]">visibility_off</span>
                  </button>
                </div>
              )}
            </div>
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
                    className={`w-full text-left p-3.5 rounded-xl border border-border-default/65 backdrop-blur-sm transition-all ${
                      notif.read
                        ? 'bg-surface/70 opacity-75'
                        : 'bg-primary/[0.10] border-primary/35 shadow-[0_0_0_1px_rgba(13,162,231,0.12)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(13,162,231,0.65)] shrink-0" />}
                        <h4 className={`text-sm truncate ${notif.read ? 'font-medium text-slate-100' : 'font-semibold text-white'}`}>
                          {formatNotificationType(notif.type)} by {notif.actorName || 'Hospital Staff'}
                        </h4>
                        {!notif.read && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] leading-none font-semibold tracking-wide uppercase bg-primary/20 text-primary border border-primary/35 shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-500">{formatNotificationDate(notif.createdAt)}</span>
                        <button
                          onClick={(event) => handleHideNotification(event, notif.id)}
                          disabled={hidingNotificationId === notif.id}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300 disabled:opacity-50"
                          aria-label="Hide notification"
                          title="Hide notification"
                        >
                          <span className="material-icons text-[13px]">visibility_off</span>
                        </button>
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
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                    <div key={`${activity.id}-${index}`} className="glass-card-enhanced p-4 rounded-xl flex items-start gap-4 border border-white/5 hover:bg-white/5 transition-all">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 shrink-0 ${activity.colorClass}`}>
                        <span className="material-icons text-lg">{activity.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                            {getActivityTypeLabel(activity)}
                          </span>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">{activity.time}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white leading-tight">{activity.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{activity.subtitle}</p>
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
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    notificationFilter === item.key
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

