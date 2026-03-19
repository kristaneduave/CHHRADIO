import { supabase } from './supabase';
import { CalendarEvent, EventType } from '../types';
import { fetchWithCache, invalidateCacheByPrefix } from '../utils/requestCache';

const normalizeIds = (ids: Iterable<string>): string[] => Array.from(new Set(ids)).filter(Boolean).sort();
const escapeForIlike = (value: string) => value.replace(/[%_,]/g, (char) => `\\${char}`);
const sanitizeUuidList = (ids: string[]) => ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));

export const buildCalendarSearchOrClause = (normalizedQuery: string, userIds: string[]): string => {
    const escaped = escapeForIlike(normalizedQuery);
    const textConditions = `title.ilike.%${escaped}%,description.ilike.%${escaped}%`;
    const safeIds = sanitizeUuidList(userIds);
    if (!safeIds.length) return textConditions;
    const joined = safeIds.join(',');
    const userConditions = `assigned_to.in.(${joined}),created_by.in.(${joined})`;
    return `${textConditions},${userConditions}`;
};

const normalizeCoverageDetails = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry: any) => ({
            user_id: typeof entry?.user_id === 'string' && entry.user_id ? entry.user_id : undefined,
            name: typeof entry?.name === 'string' ? entry.name.trim() : '',
            modalities: Array.isArray(entry?.modalities)
                ? entry.modalities.filter((modality: unknown) => typeof modality === 'string' && modality.trim().length > 0)
                : [],
        }))
        .filter((entry: any) => entry.name || entry.user_id);
};

const fetchProfilesByIds = async (ids: string[]) => {
    const normalized = normalizeIds(ids);
    if (!normalized.length) return [];
    const key = `calendar:profiles:${normalized.join(',')}`;
    const { data, error } = await fetchWithCache(
        key,
        () =>
            supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role, nickname')
                .in('id', normalized),
        { ttlMs: 60_000, allowStaleWhileRevalidate: true },
    );
    if (error) throw error;
    return data || [];
};

const hydrateEventsWithProfiles = async (events: any[]): Promise<CalendarEvent[]> => {
    const userIds = new Set<string>();
    events.forEach(e => {
        if (e.covered_by) userIds.add(e.covered_by);
        if (e.assigned_to) userIds.add(e.assigned_to);
        if (e.created_by) userIds.add(e.created_by);
        if (e.coverage_details && Array.isArray(e.coverage_details)) {
            e.coverage_details.forEach((d: any) => {
                if (d.user_id) userIds.add(d.user_id);
            });
        }
    });

    const profiles = await fetchProfilesByIds(normalizeIds(userIds));
    if (!profiles.length) return events as CalendarEvent[];

    return events.map(event => {
        let enrichedCoverage = event.coverage_details;
        if (event.coverage_details && Array.isArray(event.coverage_details)) {
            enrichedCoverage = event.coverage_details.map((d: any) => ({
                ...d,
                user: profiles.find(p => p.id === d.user_id),
            }));
        }

        return {
            ...event,
            covered_user: event.covered_by ? profiles.find(p => p.id === event.covered_by) : undefined,
            user: (event.assigned_to || (event.event_type === 'leave' ? event.created_by : undefined)) ?
                profiles.find(p => p.id === (event.assigned_to || event.created_by)) : undefined,
            creator: event.created_by ? profiles.find(p => p.id === event.created_by) : undefined,
            coverage_details: enrichedCoverage,
        };
    }) as CalendarEvent[];
};

export const CalendarService = {
    async getEvents(startDate: Date, endDate: Date, filters?: { type?: EventType[] }) {
        const typeKey = filters?.type && filters.type.length > 0 ? normalizeIds(filters.type).join(',') : 'all';
        const { data: events, error } = await fetchWithCache(
            `calendar:events:${startDate.toISOString()}:${endDate.toISOString()}:${typeKey}`,
            () => {
                let query = supabase
                    .from('events')
                    .select('*')
                    .gte('end_time', startDate.toISOString())
                    .lte('start_time', endDate.toISOString())
                    .order('start_time', { ascending: true });

                if (filters?.type && filters.type.length > 0) {
                    query = query.in('event_type', filters.type);
                }
                return query;
            },
            { ttlMs: 20_000, allowStaleWhileRevalidate: true },
        );
        if (error) throw error;
        return hydrateEventsWithProfiles(events || []);
    },

    async createEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'created_by' | 'covered_user'>) {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            ...event,
            coverage_details: normalizeCoverageDetails(event.coverage_details),
            created_by: user?.id,
        };

        const { data, error } = await supabase
            .from('events')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        invalidateCacheByPrefix('calendar:events:');
        invalidateCacheByPrefix('calendar:upcoming:');
        invalidateCacheByPrefix('calendar:leave:');
        invalidateCacheByPrefix('calendar:search:');
        return data as CalendarEvent;
    },

    async updateEvent(id: string, updates: Partial<CalendarEvent>) {
        // Remove covered_user from updates as it's a join field
        const { covered_user, user, ...cleanUpdates } = updates;
        const payload = {
            ...cleanUpdates,
            coverage_details: normalizeCoverageDetails(cleanUpdates.coverage_details),
        };

        const { data, error } = await supabase
            .from('events')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        invalidateCacheByPrefix('calendar:events:');
        invalidateCacheByPrefix('calendar:upcoming:');
        invalidateCacheByPrefix('calendar:leave:');
        invalidateCacheByPrefix('calendar:search:');
        return data as CalendarEvent;
    },

    async deleteEvent(id: string) {
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;
        invalidateCacheByPrefix('calendar:events:');
        invalidateCacheByPrefix('calendar:upcoming:');
        invalidateCacheByPrefix('calendar:leave:');
        invalidateCacheByPrefix('calendar:search:');
    },

    // Fetch who is on leave for a specific date
    async getLeaveEvents(date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: events, error: eventsError } = await fetchWithCache(
            `calendar:leave:${startOfDay.toISOString()}:${endOfDay.toISOString()}`,
            () =>
                supabase
                    .from('events')
                    .select('*')
                    .eq('event_type', 'leave')
                    .lte('start_time', endOfDay.toISOString())
                    .gte('end_time', startOfDay.toISOString()),
            { ttlMs: 20_000, allowStaleWhileRevalidate: true },
        );

        if (eventsError) throw eventsError;
        if (!events || events.length === 0) return [];
        return hydrateEventsWithProfiles(events);
    },

    // We can keep this or deprecate it since the agenda view might use filter
    async getUpcomingEvents(limit: number = 5) {
        const now = new Date();
        const { data, error } = await fetchWithCache(
            `calendar:upcoming:${limit}:${now.toISOString().slice(0, 16)}`,
            () =>
                supabase
                    .from('events')
                    .select('*')
                    .gte('end_time', now.toISOString())
                    .order('start_time', { ascending: true })
                    .limit(limit),
            { ttlMs: 15_000, allowStaleWhileRevalidate: true },
        );
        if (error) throw error;
        return hydrateEventsWithProfiles(data || []);
    },

    async searchEvents(query: string) {
        if (!query) return [];
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return [];
        const cached = await fetchWithCache(
            `calendar:search:${normalizedQuery}`,
            async () => {
                // 1. Find users matching the query
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, role, nickname')
                    .ilike('full_name', `%${normalizedQuery}%`);

                if (profileError) throw profileError;

                let userIds: string[] = [];
                if (profiles) {
                    userIds = profiles.map(p => p.id);
                }

                let eventQuery = supabase
                    .from('events')
                    .select('*')
                    .gte('end_time', new Date().toISOString())
                    .order('start_time', { ascending: true });

                const orCondition = buildCalendarSearchOrClause(normalizedQuery, userIds);

                const { data: events, error: eventError } = await eventQuery.or(orCondition);
                if (eventError) throw eventError;
                return events || [];
            },
            { ttlMs: 15_000, allowStaleWhileRevalidate: true },
        );
        return hydrateEventsWithProfiles(cached || []);
    },

    async preloadCalendarData(date: Date, upcomingLimit = 10) {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        await Promise.all([
            CalendarService.getEvents(start, end),
            CalendarService.getUpcomingEvents(upcomingLimit),
        ]);
    }
};
