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

        const { data, error } = await query;
        if (error) throw error;

        return data as CalendarEvent[];
    },

    async createEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'created_by'>) {
        const { data, error } = await supabase
            .from('events')
            .insert([event])
            .select()
            .single();

        if (error) throw error;
        return data as CalendarEvent;
    },

    async updateEvent(id: string, updates: Partial<CalendarEvent>) {
        const { data, error } = await supabase
            .from('events')
            .update(updates)
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
    // This requires a join with profiles table which we assume exists and is linked by id
    async getLeaveEvents(date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // We need to fetch events of type 'leave' that overlap with today
        // And get the user details. 
        // Since we don't know the exact foreign key relationship name for profiles in the schema (if it's not set up),
        // we might need to fetch events first and then fetch profiles, or try a join.
        // Let's try to assume 'profiles' is the table and it shares ID with auth.users.
        // But 'created_by' is the auth user id.

        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .eq('event_type', 'leave')
            .lte('start_time', endOfDay.toISOString())
            .gte('end_time', startOfDay.toISOString());

        if (eventsError) throw eventsError;
        if (!events || events.length === 0) return [];

        // Get unique user IDs from the events (either assigned_to or created_by)
        // For leave, it's usually the person who created it OR who it is assigned to.
        // Let's assume assigned_to if present, else created_by.
        const userIds = [...new Set(events.map(e => e.assigned_to || e.created_by))];

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        // Merge profile data into events
        return events.map(event => {
            const userId = event.assigned_to || event.created_by;
            const profile = profiles?.find(p => p.id === userId);
            return {
                ...event,
                user: profile
            };
        });
    }
};
