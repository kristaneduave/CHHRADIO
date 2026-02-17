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

        // Collect all user IDs to fetch (assigned_to, covered_by, and those in coverage_details)
        const userIds = new Set<string>();
        events.forEach(e => {
            if (e.covered_by) userIds.add(e.covered_by);
            if (e.assigned_to) userIds.add(e.assigned_to);
            if (e.assigned_to) userIds.add(e.assigned_to);
            // Always fetch creator
            if (e.created_by) userIds.add(e.created_by);

            // Handle coverage_details
            if (e.coverage_details && Array.isArray(e.coverage_details)) {
                e.coverage_details.forEach((d: any) => {
                    if (d.user_id) userIds.add(d.user_id);
                });
            }
        });

        if (userIds.size > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .in('id', Array.from(userIds));

            if (!profilesError && profiles) {
                return events.map(event => {
                    // Enrich coverage_details with user profiles
                    let enrichedCoverage = event.coverage_details;
                    if (event.coverage_details && Array.isArray(event.coverage_details)) {
                        enrichedCoverage = event.coverage_details.map((d: any) => ({
                            ...d,
                            user: profiles.find(p => p.id === d.user_id)
                        }));
                    }

                    return {
                        ...event,
                        covered_user: event.covered_by ? profiles.find(p => p.id === event.covered_by) : undefined,
                        user: (event.assigned_to || (event.event_type === 'leave' ? event.created_by : undefined)) ?
                            profiles.find(p => p.id === (event.assigned_to || event.created_by)) : undefined,
                        creator: event.created_by ? profiles.find(p => p.id === event.created_by) : undefined,
                        coverage_details: enrichedCoverage
                    }
                }) as CalendarEvent[];
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
        const { covered_user, user, ...cleanUpdates } = updates;

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

        // Get unique user IDs involved
        const userIds = new Set<string>();
        events.forEach(e => {
            if (e.assigned_to) userIds.add(e.assigned_to);
            userIds.add(e.created_by);
            if (e.covered_by) userIds.add(e.covered_by);

            if (e.coverage_details && Array.isArray(e.coverage_details)) {
                e.coverage_details.forEach((d: any) => {
                    if (d.user_id) userIds.add(d.user_id);
                });
            }
        });

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url')
            .in('id', Array.from(userIds));

        if (profilesError) throw profilesError;

        // Merge profile data into events
        return events.map(event => {
            const userId = event.assigned_to || event.created_by;
            const profile = profiles?.find(p => p.id === userId);
            const coverProfile = event.covered_by ? profiles?.find(p => p.id === event.covered_by) : undefined;
            const creatorProfile = event.created_by ? profiles?.find(p => p.id === event.created_by) : undefined;

            // Enrich coverage_details
            let enrichedCoverage = event.coverage_details;
            if (event.coverage_details && Array.isArray(event.coverage_details)) {
                enrichedCoverage = event.coverage_details.map((d: any) => ({
                    ...d,
                    user: profiles?.find(p => p.id === d.user_id)
                }));
            }

            return {
                ...event,
                user: profile,
                covered_user: coverProfile,
                creator: creatorProfile,
                coverage_details: enrichedCoverage
            };
        });
    },

    // We can keep this or deprecate it since the agenda view might use filter
    async getUpcomingEvents(limit: number = 5) {
        const now = new Date();
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .gte('end_time', now.toISOString())
            .order('start_time', { ascending: true })
            .limit(limit);

        // We should probably fetch profiles here too if we want avatars in upcoming
        if (data && data.length > 0) {
            // Simplified fetch just for covered_by/assigned_to
            const userIds = new Set<string>();
            data.forEach(e => {
                if (e.covered_by) userIds.add(e.covered_by);
                if (e.assigned_to) userIds.add(e.assigned_to);
                if (e.assigned_to) userIds.add(e.assigned_to);
                if (e.created_by) userIds.add(e.created_by);
            });

            if (userIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, role')
                    .in('id', Array.from(userIds));

                if (profiles) {
                    return data.map(event => ({
                        ...event,
                        covered_user: event.covered_by ? profiles.find(p => p.id === event.covered_by) : undefined,
                        user: (event.assigned_to || (event.event_type === 'leave' ? event.created_by : undefined)) ?
                            profiles.find(p => p.id === (event.assigned_to || event.created_by)) : undefined
                    })) as CalendarEvent[];
                }
            }
        }

        if (error) throw error;
        return data as CalendarEvent[];
    },

    async searchEvents(query: string) {
        if (!query) return [];

        // 1. Find users matching the query
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .ilike('full_name', `%${query}%`);

        if (profileError) throw profileError;

        let userIds: string[] = [];
        if (profiles) {
            userIds = profiles.map(p => p.id);
        }

        // 2. Find events where:
        //    - Title matches query OR
        //    - Description matches query OR
        //    - Assigned_to is in userIds OR
        //    - Created_by is in userIds (for leaves)

        let eventQuery = supabase
            .from('events')
            .select('*')
            .gte('end_time', new Date().toISOString()) // Only future events? Or all? Let's say all future for now as user asked for "dates where that consultant WOULD BE on leave"
            .order('start_time', { ascending: true });

        // Currently Supabase JS client doesn't support complex ORs easily with joined tables in one go without raw SQL or multiple queries.
        // We will fetch based on text match OR user match.

        // Simple text match on event fields
        const textConditions = `title.ilike.%${query}%,description.ilike.%${query}%`;

        // If we found users, add their IDs to the OR condition
        let orCondition = textConditions;
        if (userIds.length > 0) {
            // assigned_to.in.(${userIds}),created_by.in.(${userIds})
            // proper syntax for .or() is `column.operator.value,column.operator.value`
            const userConditions = `assigned_to.in.(${userIds.join(',')}),created_by.in.(${userIds.join(',')})`;
            orCondition = `${textConditions},${userConditions}`;
        }

        const { data: events, error: eventError } = await eventQuery.or(orCondition);

        if (eventError) throw eventError;

        // 3. hydration (profiles)
        // We might need to fetch MORE profiles if the events returned involve users NOT in our initial `profiles` search
        // For simplicity, let's just re-fetch all needed profiles for the result set.
        const allUserIds = new Set<string>();
        events?.forEach(e => {
            if (e.covered_by) allUserIds.add(e.covered_by);
            if (e.assigned_to) allUserIds.add(e.assigned_to);
            if (e.assigned_to) allUserIds.add(e.assigned_to);
            if (e.assigned_to) allUserIds.add(e.assigned_to);
            if (e.created_by) allUserIds.add(e.created_by);
        });

        if (allUserIds.size > 0) {
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .in('id', Array.from(allUserIds));

            if (allProfiles) {
                return events?.map(event => ({
                    ...event,
                    covered_user: event.covered_by ? allProfiles.find(p => p.id === event.covered_by) : undefined,
                    user: (event.assigned_to || (event.event_type === 'leave' ? event.created_by : undefined)) ?
                        allProfiles.find(p => p.id === (event.assigned_to || event.created_by)) : undefined,
                    creator: event.created_by ? allProfiles.find(p => p.id === event.created_by) : undefined
                })) as CalendarEvent[];
            }
        }

        return events as CalendarEvent[];
    }
};
