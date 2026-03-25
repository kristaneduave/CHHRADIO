import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, getCurrentUserRoleState, getEvents, getUpcomingEvents } = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  getCurrentUserRoleState: vi.fn(async () => ({
    primaryRole: 'resident',
    roles: ['resident', 'moderator'],
  })),
  getEvents: vi.fn(async () => [{ id: 'event-1' }]),
  getUpcomingEvents: vi.fn(async () => [{ id: 'upcoming-1' }]),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser,
    },
  },
}));

vi.mock('./userRoleService', () => ({
  getCurrentUserRoleState,
}));

vi.mock('./CalendarService', () => ({
  CalendarService: {
    getEvents,
    getUpcomingEvents,
  },
}));

describe('calendarWorkspaceService', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockClear();
    getCurrentUserRoleState.mockClear();
    getEvents.mockClear();
    getUpcomingEvents.mockClear();
  });

  it('reuses cached workspace data for the same month', async () => {
    const { getCalendarWorkspace, getCachedCalendarWorkspace } = await import('./calendarWorkspaceService');
    const date = new Date('2026-03-25T00:00:00.000Z');

    const first = await getCalendarWorkspace({ date });
    const second = await getCalendarWorkspace({ date });

    expect(first).toBe(second);
    expect(getCachedCalendarWorkspace(date)).toBe(first);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getCurrentUserRoleState).toHaveBeenCalledTimes(1);
    expect(getEvents).toHaveBeenCalledTimes(1);
    expect(getUpcomingEvents).toHaveBeenCalledTimes(1);
  });

  it('rebuilds workspace data when force refresh is requested', async () => {
    const { getCalendarWorkspace } = await import('./calendarWorkspaceService');
    const date = new Date('2026-03-25T00:00:00.000Z');

    const first = await getCalendarWorkspace({ date });
    const second = await getCalendarWorkspace({ date, force: true });

    expect(second).not.toBe(first);
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(getCurrentUserRoleState).toHaveBeenCalledTimes(2);
    expect(getEvents).toHaveBeenCalledTimes(2);
    expect(getUpcomingEvents).toHaveBeenCalledTimes(2);
  });
});
