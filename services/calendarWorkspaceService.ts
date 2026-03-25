import { CalendarEvent, UserRole } from '../types';
import { CalendarService } from './CalendarService';
import { supabase } from './supabase';
import { getCurrentUserRoleState } from './userRoleService';

export interface CalendarWorkspaceData {
  currentUserId: string;
  userRole: UserRole;
  userRoles: UserRole[];
  monthKey: string;
  events: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
}

const calendarWorkspaceCache = new Map<string, CalendarWorkspaceData>();
const calendarWorkspacePromises = new Map<string, Promise<CalendarWorkspaceData>>();

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const buildCalendarWorkspace = async (date: Date): Promise<CalendarWorkspaceData> => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  const [{ data: auth }, roleState, events, upcomingEvents] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentUserRoleState(),
    CalendarService.getEvents(monthStart, monthEnd),
    CalendarService.getUpcomingEvents(10),
  ]);

  return {
    currentUserId: auth.user?.id || '',
    userRole: roleState?.primaryRole || 'resident',
    userRoles: roleState?.roles || ['resident'],
    monthKey: getMonthKey(date),
    events,
    upcomingEvents,
  };
};

export const getCalendarWorkspace = async (options?: { force?: boolean; date?: Date }): Promise<CalendarWorkspaceData> => {
  const date = options?.date || new Date();
  const monthKey = getMonthKey(date);
  const force = Boolean(options?.force);

  if (!force && calendarWorkspaceCache.has(monthKey)) {
    return calendarWorkspaceCache.get(monthKey)!;
  }

  if (!force && calendarWorkspacePromises.has(monthKey)) {
    return calendarWorkspacePromises.get(monthKey)!;
  }

  const request = buildCalendarWorkspace(date)
    .then((workspace) => {
      calendarWorkspaceCache.set(monthKey, workspace);
      return workspace;
    })
    .finally(() => {
      calendarWorkspacePromises.delete(monthKey);
    });

  calendarWorkspacePromises.set(monthKey, request);
  return request;
};

export const getCachedCalendarWorkspace = (date: Date = new Date()): CalendarWorkspaceData | null =>
  calendarWorkspaceCache.get(getMonthKey(date)) || null;

export const preloadCalendarWorkspace = async (date: Date = new Date()): Promise<void> => {
  await getCalendarWorkspace({ date });
};
