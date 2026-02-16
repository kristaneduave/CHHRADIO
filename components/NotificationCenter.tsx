
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { fetchRecentActivity } from '../services/activityService';
import { Activity } from '../types';

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
}

// Mock notifications for now
const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'System Update',
        message: 'The system has been updated to version 2.0.',
        time: '2 hours ago',
        read: false,
        type: 'info'
    },
    {
        id: '2',
        title: 'Welcome',
        message: 'Welcome to the CHH Radiology App.',
        time: '1 day ago',
        read: true,
        type: 'success'
    }
];

interface NotificationCenterProps {
    onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(true);
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    useEffect(() => {
        if (activeTab === 'activity') {
            loadActivity();
        }
    }, [activeTab]);

    const loadActivity = async () => {
        try {
            setLoadingActivity(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const data = await fetchRecentActivity(user.id, 50);
                setActivities(data);
            }
        } catch (error) {
            console.error('Error loading activity log:', error);
        } finally {
            setLoadingActivity(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-[#050B14]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#0A121A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-right-10 duration-300">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0F1720]">
                    <div>
                        <h2 className="text-lg font-bold text-white">Notification Center</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
                    >
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-3 text-xs font-medium transition-colors relative ${activeTab === 'notifications' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Notifications
                        {activeTab === 'notifications' && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={`flex-1 py-3 text-xs font-medium transition-colors relative ${activeTab === 'activity' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Recent Activity
                        {activeTab === 'activity' && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                    {activeTab === 'notifications' ? (
                        <div className="p-4 space-y-3">
                            {notifications.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <span className="material-icons text-4xl mb-2 opacity-50">notifications_off</span>
                                    <p className="text-sm">No new notifications.</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div key={notif.id} className={`p-3 rounded-xl border border-white/5 ${notif.read ? 'bg-transparent opacity-60' : 'bg-white/5'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-sm font-semibold text-white">{notif.title}</h4>
                                            <span className="text-[10px] text-slate-500">{notif.time}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {loadingActivity ? (
                                <div className="text-center py-12 text-slate-500">
                                    <span className="material-icons animate-spin text-2xl mb-2">sync</span>
                                    <p className="text-xs">Loading history...</p>
                                </div>
                            ) : activities.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <span className="material-icons text-4xl mb-2 opacity-50">history</span>
                                    <p className="text-sm">No recent activity found.</p>
                                </div>
                            ) : (
                                activities.map((activity, index) => (
                                    <div
                                        key={`${activity.id}-${index}`}
                                        className="glass-card-enhanced p-3 rounded-xl flex items-start gap-4 border border-white/5 hover:bg-white/5 transition-all"
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 shrink-0 ${activity.colorClass}`}>
                                            <span className="material-icons text-sm">{activity.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-xs font-bold text-white leading-tight">{activity.title}</h4>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{activity.time}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{activity.subtitle}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer (Optional) */}
                <div className="p-3 border-t border-white/5 bg-[#0F1720]/50 text-center">
                    <button className="text-[10px] text-primary hover:text-primary-light transition-colors">
                        Mark all as read
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationCenter;
