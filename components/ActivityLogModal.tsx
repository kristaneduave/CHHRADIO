
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { fetchRecentActivity } from '../services/activityService';
import { Activity } from '../types';

interface ActivityLogModalProps {
    onClose: () => void;
}

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ onClose }) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050B14]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-[#0A121A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] m-4 animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0F1720]">
                    <div>
                        <h2 className="text-lg font-bold text-white">Activity Log</h2>
                        <p className="text-xs text-slate-400">Your recent history</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
                    >
                        <span className="material-icons text-sm">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
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
                                className="glass-card-enhanced p-3 rounded-xl flex items-start gap-4 border border-white/5 hover:bg-white/5 transition-all"
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
        </div>
    );
};

export default ActivityLogModal;
