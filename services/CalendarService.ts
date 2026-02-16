import { supabase } from './supabase';
import { CalendarEvent, EventType } from '../types';

export const CalendarService = {
    async getEvents(startDate: Date, endDate: Date, filters?: { type?: EventType[] }) {
        let query = supabase
            .from('events')
            .select('*')
            .gte('end_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString())
            .order('start_time', { ascending: true });

        if (filters?.type && filters.type.length > 0) {
            query = query.in('event_type', filters.type);
        }

        const { data: events, error } = await query;
        if (error) throw error;

        // We need to fetch covered_by user details if present
        const coverageUserIds = [...new Set(events.filter(e => e.covered_by).map(e => e.covered_by))];

        if (coverageUserIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', coverageUserIds);

            if (!profilesError && profiles) {
                return events.map(event => ({
                    ...event,
                    covered_user: event.covered_by ? profiles.find(p => p.id === event.covered_by) : undefined
                })) as CalendarEvent[];
            }
        }

        return events as CalendarEvent[];
    },

    async createEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'created_by' | 'covered_user'>) {
        const { data, error } = await supabase
            .from('events')
            .insert([event])
            .select()
            .single();

        if (error) throw error;
        return data as CalendarEvent;
    },

    async updateEvent(id: string, updates: Partial<CalendarEvent>) {
        // Remove covered_user from updates as it's a join field
        const { covered_user, ...cleanUpdates } = updates;

        const { data, error } = await supabase
            .from('events')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as CalendarEvent;
    },

    async deleteEvent(id: string) {
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Fetch who is on leave for a specific date
    async getLeaveEvents(date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .eq('event_type', 'leave')
            // Check for overlap: event start <= EOD AND event end >= SOD
            .lte('start_time', endOfDay.toISOString())
            .gte('end_time', startOfDay.toISOString());

        if (eventsError) throw eventsError;
        if (!events || events.length === 0) return [];

        // Get unique user IDs involved (users on leave AND users covering)
        const userIds = [...new Set([
            ...events.map(e => e.assigned_to || e.created_by),
            ...events.filter(e => e.covered_by).map(e => e.covered_by)
        ])];

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Merge profile data into events
        return events.map(event => {
            const userId = event.assigned_to || event.created_by;
            const profile = profiles?.find(p => p.id === userId);
            const coverProfile = event.covered_by ? profiles?.find(p => p.id === event.covered_by) : undefined;

            return {
                ...event,
                user: profile,
                covered_user: coverProfile
            };
        });
    },

    async getUpcomingEvents(limit: number = 5) {
        const now = new Date();
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .gte('end_time', now.toISOString())
            .order('start_time', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data as CalendarEvent[];
    }
};
