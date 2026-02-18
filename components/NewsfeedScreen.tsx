
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

const NewsfeedScreen: React.FC = () => {
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
        <div className="min-h-screen bg-[#050B14] pb-24">
            {/* Header */}
            <header className="px-6 pt-12 pb-6 border-b border-white/5 bg-[#050B14]/80 backdrop-blur-md sticky top-0 z-20">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                    Newsfeed
                </h1>
                <p className="text-xs text-slate-500 mt-1">Updates, alerts, and recent activity</p>
            </header>

            {/* Tabs */}
            <div className="px-6 py-4">
                <div className="flex bg-white/5 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'notifications'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Notifications
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'activity'
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Activity Log
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 space-y-4">
                {activeTab === 'notifications' ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {notifications.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <span className="material-icons text-4xl mb-2 opacity-50">notifications_off</span>
                                <p className="text-sm">No new notifications.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} className={`p-4 rounded-xl border border-white/5 backdrop-blur-sm ${notif.read ? 'bg-white/5 opacity-60' : 'bg-white/10 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.5)]'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {notif.type === 'info' && <span className="material-icons text-blue-400 text-sm">info</span>}
                                            {notif.type === 'success' && <span className="material-icons text-green-400 text-sm">check_circle</span>}
                                            <h4 className="text-sm font-bold text-white">{notif.title}</h4>
                                        </div>
                                        <span className="text-[10px] text-slate-500">{notif.time}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                                    className="glass-card-enhanced p-4 rounded-xl flex items-start gap-4 border border-white/5 hover:bg-white/5 transition-all"
                                >
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
        </div>
    );
};

export default NewsfeedScreen;
