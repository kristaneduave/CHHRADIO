
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { fetchRecentActivity } from '../services/activityService';
import { Activity } from '../types';

interface ActivityLogScreenProps {
    onBack: () => void;
}

const ActivityLogScreen: React.FC<ActivityLogScreenProps> = ({ onBack }) => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivity();
    }, []);

    const loadActivity = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch more for the full log (e.g., 50)
                const data = await fetchRecentActivity(user.id, 50);
                setActivities(data);
            }
        } catch (error) {
            console.error('Error loading activity log:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050B14] animate-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 glass-panel px-6 py-4 flex items-center gap-4 border-b border-white/10">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
                >
                    <span className="material-icons">arrow_back</span>
                </button>
                <div>
                    <h1 className="text-lg font-bold text-white">Activity Log</h1>
                    <p className="text-xs text-slate-400">Your recent history</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                {loading ? (
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
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 shrink-0 ${activity.colorClass}`}>
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
        </div>
    );
};

export default ActivityLogScreen;
