import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUser,
  getCurrentUserRoleState,
  fetchHiddenAnnouncementIds,
  fetchWithCache,
  invalidateCacheByPrefix,
} = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  getCurrentUserRoleState: vi.fn(async () => ({
    primaryRole: 'resident',
    roles: ['resident', 'moderator'],
  })),
  fetchHiddenAnnouncementIds: vi.fn(async () => new Set(['hidden-1'])),
  fetchWithCache: vi.fn(async (_key: string, factory: () => Promise<any>) => factory()),
  invalidateCacheByPrefix: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(async () => ({
                data: [
                  {
                    id: 'announcement-1',
                    title: 'Title',
                    content: 'Content',
                    created_at: '2026-03-25T00:00:00.000Z',
                    category: 'general',
                    author_id: 'user-1',
                  },
                ],
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('./userRoleService', () => ({
  getCurrentUserRoleState,
}));

vi.mock('./announcementVisibilityService', () => ({
  fetchHiddenAnnouncementIds,
}));

vi.mock('../utils/requestCache', () => ({
  fetchWithCache,
  invalidateCacheByPrefix,
}));

describe('announcementsWorkspaceService', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockClear();
    getCurrentUserRoleState.mockClear();
    fetchHiddenAnnouncementIds.mockClear();
    fetchWithCache.mockClear();
    invalidateCacheByPrefix.mockClear();
  });

  it('reuses cached workspace data across repeated requests', async () => {
    const { getAnnouncementsWorkspace, getCachedAnnouncementsWorkspace } = await import('./announcementsWorkspaceService');

    const first = await getAnnouncementsWorkspace();
    const second = await getAnnouncementsWorkspace();

    expect(first).toBe(second);
    expect(getCachedAnnouncementsWorkspace()).toBe(first);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getCurrentUserRoleState).toHaveBeenCalledTimes(1);
    expect(fetchHiddenAnnouncementIds).toHaveBeenCalledTimes(1);
    expect(fetchWithCache).toHaveBeenCalledTimes(1);
  });

  it('rebuilds workspace data when force refresh is requested', async () => {
    const { getAnnouncementsWorkspace } = await import('./announcementsWorkspaceService');

    const first = await getAnnouncementsWorkspace();
    const second = await getAnnouncementsWorkspace({ force: true });

    expect(second).not.toBe(first);
    expect(getUser).toHaveBeenCalledTimes(2);
    expect(getCurrentUserRoleState).toHaveBeenCalledTimes(2);
    expect(fetchHiddenAnnouncementIds).toHaveBeenCalledTimes(2);
    expect(fetchWithCache).toHaveBeenCalledTimes(2);
  });
});
