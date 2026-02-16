import React, { useEffect, useState } from 'react';
import { CalendarService } from '../services/CalendarService';
import { CalendarEvent } from '../types';

interface LeaveListProps {
    date: Date;
}

interface LeaveEventWithUser extends CalendarEvent {
    user?: {
        full_name: string | null;
        role: string;
        avatar_url: string | null;
    };
}

export const LeaveList: React.FC<LeaveListProps> = ({ date }) => {
    const [leaves, setLeaves] = useState<LeaveEventWithUser[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLeaves = async () => {
            setLoading(true);
            try {
                const data = await CalendarService.getLeaveEvents(date);
                setLeaves(data as LeaveEventWithUser[]);
            } catch (error) {
                console.error('Error fetching leave events:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaves();
    }, [date]);

    const consultants = leaves.filter(l => l.user?.role === 'consultant' || l.user?.role === 'faculty');
    const residents = leaves.filter(l => l.user?.role === 'resident');

    if (loading) {
        return <div className="animate-pulse flex space-y-2 flex-col p-4 opacity-50">
            <div className="h-4 bg-slate-700 rounded w-1/3"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        </div>;
    }

    if (leaves.length === 0) {
        return (
            <div className="p-4 glass-card-enhanced rounded-xl text-center">
                <p className="text-slate-500 text-xs">No one is on leave today.</p>
            </div>
        );
    }

    const renderSection = (title: string, items: LeaveEventWithUser[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-4 last:mb-0">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</h4>
                <div className="space-y-2">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border border-white/10">
                                {item.user?.avatar_url ? (
                                    <img src={item.user.avatar_url} alt={item.user.full_name || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold text-slate-400">
                                        {item.user?.full_name ? item.user.full_name.charAt(0) : '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-white">{item.user?.full_name}</p>
                                <p className="text-[10px] text-slate-400">{item.title || 'On Leave'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="glass-card-enhanced p-4 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-icons text-orange-400 text-base">beach_access</span>
                Who's on Leave
            </h3>
            {renderSection('Consultants', consultants)}
            {renderSection('Residents', residents)}
            {/* Fallback for others if needed */}
            {renderSection('Others', leaves.filter(l => !['consultant', 'faculty', 'resident'].includes(l.user?.role || '')))}
        </div>
    );
};
