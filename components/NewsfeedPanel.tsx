import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { Activity, NewsfeedNotification, Screen } from '../types';
import { fetchRecentActivity } from '../services/activityService';
import {
  fetchNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../services/newsfeedService';
import LoadingButton from './LoadingButton';
import LoadingState from './LoadingState';

interface NewsfeedPanelProps {
  variant: 'screen' | 'modal';
  onClose?: () => void;
  onNavigateToTarget?: (screen: Screen, entityId?: string | null) => void;
}

const NewsfeedPanel: React.FC<NewsfeedPanelProps> = ({ variant, onClose, onNavigateToTarget }) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState<NewsfeedNotification[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const isModal = variant === 'modal';
  const listPadding = isModal ? 'p-4' : 'px-6';

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  useEffect(() => {
    let cleanup = () => {};
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || '';
      setUserId(uid);
      if (!uid) return;

      await refreshNotifications(uid);
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
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'activity' && userId) {
      loadActivity(userId);
    }
  }, [activeTab, userId]);

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

    if (notif.linkScreen && onNavigateToTarget) {
      onNavigateToTarget(notif.linkScreen, notif.linkEntityId);
      onClose?.();
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId || unreadCount === 0) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead(userId);
    } catch (error) {
      console.error('Failed to mark all read:', error);
      setNotifications(previous);
    }
  };

  return (
    <>
      <div className={`${isModal ? 'p-4 border-b border-white/5 bg-surface' : 'px-6 pt-12 pb-6 border-b border-white/5 bg-app/80 backdrop-blur-md sticky top-0 z-20'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${isModal ? 'text-lg' : 'text-2xl'} font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400`}>
              {isModal ? 'Notification Center' : 'Newsfeed'}
            </h1>
            {!isModal && <p className="text-xs text-slate-500 mt-1">Updates, alerts, and recent activity</p>}
          </div>
          {isModal && onClose && (
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
              <span className="material-icons text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      <div className={isModal ? 'p-4 border-b border-white/5' : 'px-6 py-4'}>
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
      </div>

      <div className={`${listPadding} ${isModal ? 'flex-1 overflow-y-auto' : ''} space-y-4`}>
        {activeTab === 'notifications' ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {loadingNotifications ? (
              <LoadingState title="Loading notifications..." compact />
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <span className="material-icons text-4xl mb-2 opacity-50">notifications_off</span>
                <p className="text-sm">No notifications.</p>
              </div>
            ) : (
              <>
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-4 rounded-xl border border-white/5 backdrop-blur-sm transition-all ${
                      notif.read ? 'bg-white/5 opacity-70' : 'bg-white/10 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {notif.severity === 'info' && <span className="material-icons text-blue-400 text-sm">info</span>}
                        {notif.severity === 'warning' && <span className="material-icons text-amber-400 text-sm">warning</span>}
                        {notif.severity === 'critical' && <span className="material-icons text-rose-400 text-sm">priority_high</span>}
                        <h4 className="text-sm font-bold text-white">{notif.title}</h4>
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-[10px] text-slate-500">{notif.time}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                  </button>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-primary hover:text-primary-light transition-colors disabled:opacity-50"
                    disabled={unreadCount === 0}
                  >
                    Mark all as read
                  </button>
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
              activities.map((activity, index) => (
                <div key={`${activity.id}-${index}`} className="glass-card-enhanced p-4 rounded-xl flex items-start gap-4 border border-white/5 hover:bg-white/5 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 shrink-0 ${activity.colorClass}`}>
                    <span className="material-icons text-lg">{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-white leading-tight">{activity.title}</h4>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{activity.time}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{activity.subtitle}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default NewsfeedPanel;
