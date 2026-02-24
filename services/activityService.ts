
import { supabase } from './supabase';
import { Activity } from '../types';

interface RawActivity {
    id: string;
    title: string;
    subtitle: string;
    time: number;
    icon: string;
    colorClass: string;
    originalDate: string;
}

export const fetchRecentActivity = async (userId: string, limit: number = 5): Promise<Activity[]> => {
    try {
        const rawActivities: RawActivity[] = [];

        // 1. Fetch Published Cases
        const { data: cases, error: casesError } = await supabase
            .from('cases')
            .select('*')
            .eq('created_by', userId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!casesError && cases) {
            cases.forEach(c => {
                rawActivities.push({
                    id: `case-${c.id}`,
                    title: `Published Case: ${c.title}`,
                    subtitle: c.diagnosis || 'Radiology Case',
                    time: new Date(c.created_at).getTime(),
                    icon: 'upload_file',
                    colorClass: 'bg-emerald-500/10 text-emerald-500',
                    originalDate: c.created_at
                });
            });
        }

        // 2. Fetch Profile Updates
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('updated_at, avatar_url')
            .eq('id', userId)
            .single();

        if (!profileError && profile) {
            rawActivities.push({
                id: `profile-${profile.updated_at}`,
                title: 'Updated Profile',
                subtitle: 'Personal details modified',
                time: new Date(profile.updated_at).getTime(),
                icon: 'edit',
                colorClass: 'bg-blue-500/10 text-blue-500',
                originalDate: profile.updated_at
            });
        }

        // 3. Fetch Recent Chat Sessions
        const { data: chats, error: chatError } = await supabase
            .from('chat_sessions')
            .select('*')
            .contains('participants', [userId])
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (!chatError && chats) {
            chats.forEach(chat => {
                rawActivities.push({
                    id: `chat-${chat.id}`,
                    title: `Chat: ${chat.title}`,
                    subtitle: 'Active conversation',
                    time: new Date(chat.created_at).getTime(),
                    icon: 'chat',
                    colorClass: 'bg-purple-500/10 text-purple-500',
                    originalDate: chat.created_at
                });
            });
        }

        // Sort and Map
        return rawActivities
            .sort((a, b) => b.time - a.time)
            .slice(0, limit)
            .map(a => ({
                id: a.id,
                title: a.title,
                subtitle: a.subtitle,
                time: formatTimeAgo(a.time),
                createdAt: a.originalDate,
                icon: a.icon,
                colorClass: a.colorClass
            }));

    } catch (error) {
        console.error('Error fetching activity:', error);
        return [];
    }
};

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
