import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  userRolesIn,
  profilesIn,
} = vi.hoisted(() => ({
  userRolesIn: vi.fn(),
  profilesIn: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === 'user_roles') {
        return {
          select: vi.fn(() => ({
            in: userRolesIn,
          })),
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: profilesIn,
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  },
}));

vi.mock('../utils/requestCache', () => ({
  fetchWithCache: vi.fn(),
  invalidateCacheByPrefix: vi.fn(),
}));

describe('fetchRecipientUserIdsByRoles', () => {
  beforeEach(() => {
    userRolesIn.mockReset();
    profilesIn.mockReset();
  });

  it('merges multi-role assignments with legacy profile roles', async () => {
    userRolesIn.mockResolvedValue({
      data: [
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ],
      error: null,
    });

    profilesIn.mockResolvedValue({
      data: [
        { id: 'user-2' },
        { id: 'user-3' },
      ],
      error: null,
    });

    const { fetchRecipientUserIdsByRoles } = await import('./newsfeedService');
    const result = await fetchRecipientUserIdsByRoles(['resident', 'moderator']);

    expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    expect(userRolesIn).toHaveBeenCalledWith('role', ['resident', 'moderator']);
    expect(profilesIn).toHaveBeenCalledWith('role', ['resident', 'moderator']);
  });

  it('falls back to profile roles when the multi-role table is unavailable', async () => {
    userRolesIn.mockResolvedValue({
      data: null,
      error: { message: 'relation "user_roles" does not exist' },
    });

    profilesIn.mockResolvedValue({
      data: [{ id: 'user-9' }],
      error: null,
    });

    const { fetchRecipientUserIdsByRoles } = await import('./newsfeedService');
    const result = await fetchRecipientUserIdsByRoles(['moderator']);

    expect(result).toEqual(['user-9']);
  });
});
